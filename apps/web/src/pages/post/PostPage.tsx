import React, { useCallback, useMemo, useState } from "react";
import {
  ANTI_SPAM_MIN_INTERVAL_SECONDS,
  CORE_MODES,
  DEFAULT_TOGGLES,
  MAX_MEDIA_BYTES,
  MIN_INTERVAL_SECONDS,
  POST_TABS,
  type ComposerState,
  type Destination,
  type MediaInput,
  type MentionMode,
  type PostDraft,
  type PostTemplateDraft,
  defaultComposer,
  defaultDraft,
  normalizeInterval,
  reorderMedia,
  validateMedia,
} from "../../../../../packages/shared/contracts-post";
import "./post.css";

export interface PostPageProps {
  apiBaseUrl?: string;
  planTier?: "BASIC" | "PLUS" | "PRO";
  accountId?: string;
  initialDraft?: Partial<PostDraft>;
  onRequirePlan?: (tier: "PLUS" | "PRO") => void;
}

type Toast = { kind: "success" | "error" | "info"; text: string } | null;

const initial = defaultDraft();

/**
 * REA-backed /post surface. The component intentionally uses native controls;
 * the shell worker may wrap these with its Ant Design theme without changing
 * the API contract or the test selectors.
 */
export default function PostPage({ apiBaseUrl = "", planTier = "BASIC", accountId, initialDraft, onRequirePlan }: PostPageProps) {
  const [draft, setDraft] = useState<PostDraft>(() => mergeDraft(initial, initialDraft));
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; draft: PostTemplateDraft }>>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  const activeComposer = draft.composers[draft.activeTab] ?? defaultComposer();
  const activeMedia = draft.mediaByTab[draft.activeTab] ?? [];
  const intervalError = normalizeInterval(draft.fromSec, draft.toSec, draft.antiSpam).error;
  const modeOptions = useMemo(() => {
    const basic = CORE_MODES.slice(0, 2);
    if (planTier === "BASIC") return basic;
    return CORE_MODES;
  }, [planTier]);

  const patchDraft = useCallback((patch: Partial<PostDraft>) => setDraft((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() })), []);
  const patchComposer = useCallback((patch: Partial<ComposerState>) => {
    setDraft((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      composers: {
        ...current.composers,
        [current.activeTab]: { ...(current.composers[current.activeTab] ?? defaultComposer()), ...patch },
      },
    }));
  }, []);

  const notify = useCallback((next: Toast) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  async function saveDraft() {
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/posts/drafts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, accountId }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const saved = (await response.json()) as PostDraft;
      setDraft(saved);
      notify({ kind: "success", text: "Đã lưu tạm nội dung" });
    } catch (error) {
      // Local fallback keeps the editor usable while the API worker is booting.
      localStorage.setItem("grouppilot.postDraft", JSON.stringify({ ...draft, accountId }));
      notify({ kind: "info", text: error instanceof Error ? `Đã lưu cục bộ: ${error.message}` : "Đã lưu cục bộ" });
    } finally {
      setBusy(false);
    }
  }

  async function loadTemplates() {
    setShowTemplates(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/post-templates`);
      if (!response.ok) throw new Error(await readError(response));
      setTemplates(((await response.json()) as { items: typeof templates }).items);
    } catch (error) {
      notify({ kind: "info", text: error instanceof Error ? error.message : "Không tải được thư viện mẫu" });
    }
  }

  async function saveTemplate() {
    const name = templateName.trim();
    if (!name) {
      notify({ kind: "error", text: "Vui lòng nhập tên mẫu" });
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/api/post-templates/upsert`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, draft }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setTemplateName("");
      notify({ kind: "success", text: "Đã lưu mẫu" });
      await loadTemplates();
    } catch (error) {
      notify({ kind: "error", text: error instanceof Error ? error.message : "Lưu mẫu thất bại" });
    }
  }

  async function start() {
    if (planTier === "BASIC" && draft.destination !== "group") {
      onRequirePlan?.("PLUS");
      notify({ kind: "info", text: "Đăng lên tường / trang cá nhân cần gói PLUS" });
      return;
    }
    if (draft.antiSpam && (draft.fromSec < ANTI_SPAM_MIN_INTERVAL_SECONDS || draft.toSec < ANTI_SPAM_MIN_INTERVAL_SECONDS)) {
      notify({ kind: "error", text: "Né spam bật — khoảng cách tối thiểu là 60 giây/lần" });
      return;
    }
    if (intervalError) {
      notify({ kind: "error", text: intervalError.message });
      return;
    }
    setBusy(true);
    try {
      const savedResponse = await fetch(`${apiBaseUrl}/api/posts/drafts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, accountId }),
      });
      if (!savedResponse.ok) throw new Error(await readError(savedResponse));
      const saved = (await savedResponse.json()) as PostDraft;
      setDraft(saved);
      const response = await fetch(`${apiBaseUrl}/api/posts/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftId: saved.id, groupIds: saved.groupIds, accountId }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const job = (await response.json()) as { id: string };
      setJobId(job.id);
      notify({ kind: "success", text: "Đã bắt đầu hàng đợi đăng (MockExecutor)" });
    } catch (error) {
      notify({ kind: "error", text: error instanceof Error ? error.message : "Không thể bắt đầu" });
    } finally {
      setBusy(false);
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next: MediaInput[] = [];
    for (const file of Array.from(fileList)) {
      const error = validateMedia({ name: file.name, mimeType: file.type, sizeBytes: file.size });
      if (error) {
        notify({ kind: "error", text: error.message });
        continue;
      }
      next.push({ id: crypto.randomUUID(), name: file.name, mimeType: file.type, sizeBytes: file.size, sortOrder: activeMedia.length + next.length });
    }
    if (!next.length) return;
    setDraft((current) => ({
      ...current,
      mediaByTab: { ...current.mediaByTab, [current.activeTab]: [...(current.mediaByTab[current.activeTab] ?? []), ...next] },
      updatedAt: new Date().toISOString(),
    }));
  }

  function selectTemplate(template: (typeof templates)[number]) {
    setDraft((current) => ({ ...current, ...template.draft, id: current.id, updatedAt: new Date().toISOString() }));
    setShowTemplates(false);
    notify({ kind: "success", text: `Đã áp dụng mẫu “${template.name}”` });
  }

  const groupInput = draft.groupIds.join(", ");
  return (
    <main className="post-page" data-testid="post-page">
      <header className="post-page__header">
        <div>
          <h1>Đăng bài &amp; Bình luận</h1>
          <p className="post-page__evidence">MockExecutor · lưu dữ liệu cục bộ · chưa thực hiện hành động Facebook</p>
        </div>
        <div className="post-page__header-actions">
          <button type="button" onClick={() => void saveDraft()} disabled={busy} data-testid="save-draft">Lưu tạm</button>
          <button type="button" onClick={() => void loadTemplates()} data-testid="open-templates">Thư viện mẫu</button>
        </div>
      </header>

      <section className="post-page__layout">
        <section className="post-page__main">
          <div className="post-card" data-testid="post-editor-card">
            <div className="post-card__title-row">
              <h2>Đăng bài</h2>
              <div className="post-card__mode-icons" aria-label="Chế độ đăng">
                {modeOptions.map((mode) => (
                  <button
                    type="button"
                    key={mode.key}
                    className={draft.mode === mode.key ? "is-active" : ""}
                    aria-pressed={draft.mode === mode.key}
                    title={mode.label}
                    onClick={() => patchDraft({ mode: mode.key })}
                    data-testid={`mode-${mode.key}`}
                  >
                    {mode.key === "sequential" ? "↕" : mode.key === "cross" ? "⇅" : mode.key === "parallel" ? "⋮" : mode.key === "comment" ? "☷" : "＋"}
                  </button>
                ))}
                <button
                  type="button"
                  className={draft.wallShareEnabled ? "is-active" : ""}
                  aria-pressed={draft.wallShareEnabled}
                  title="Đăng lên tường trang/trang cá nhân rồi share vào nhóm"
                  onClick={() => {
                    if (planTier === "BASIC") {
                      onRequirePlan?.("PLUS");
                      notify({ kind: "info", text: "Đăng tường + share cần gói PLUS" });
                      return;
                    }
                    patchDraft({ wallShareEnabled: !draft.wallShareEnabled });
                  }}
                  data-testid="wall-share-toggle"
                >
                  ↗
                </button>
              </div>
            </div>
            <div className="post-tabs" role="tablist" aria-label="8 biến thể bài đăng">
              {Array.from({ length: POST_TABS }, (_, index) => index + 1).map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={draft.activeTab === tab}
                  key={tab}
                  className={draft.activeTab === tab ? "is-active" : ""}
                  onClick={() => patchDraft({ activeTab: tab })}
                  data-testid={`post-tab-${tab}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <ComposerEditor value={activeComposer} onChange={patchComposer} onMention={(mentionMode) => patchComposer({ toggles: { ...activeComposer.toggles, mentionMode } })} />
            <div className="post-link-row">
              <label htmlFor="post-link">Dán link</label>
              <input id="post-link" value={activeComposer.link ?? ""} placeholder="https://www.facebook.com/..." onChange={(event) => patchComposer({ link: event.target.value })} />
            </div>
            <MediaPicker media={activeMedia} onFiles={handleFiles} onReorder={(from, to) => setDraft((current) => ({ ...current, mediaByTab: { ...current.mediaByTab, [current.activeTab]: reorderMedia(current.mediaByTab[current.activeTab] ?? [], from, to) } }))} onRemove={(id) => setDraft((current) => ({ ...current, mediaByTab: { ...current.mediaByTab, [current.activeTab]: (current.mediaByTab[current.activeTab] ?? []).filter((file) => file.id !== id) } }))} />
            <div className="post-destination-row">
              <label htmlFor="post-destination">Đăng đến</label>
              <select id="post-destination" value={draft.destination} onChange={(event) => patchDraft({ destination: event.target.value as Destination })}>
                <option value="group">Nhóm</option>
                <option value="profile">Tường cá nhân</option>
                <option value="page">Trang cá nhân / Page</option>
              </select>
              <input aria-label="ID nhóm" placeholder="ID nhóm, cách nhau bằng dấu phẩy" value={groupInput} onChange={(event) => patchDraft({ groupIds: event.target.value.split(",").map((id) => id.trim()).filter(Boolean) })} />
            </div>
          </div>

          <section className="post-card comment-card" data-testid="comment-card">
            <div className="post-card__title-row">
              <h2>Bình luận</h2>
              <label className="switch-label"><input type="checkbox" checked={draft.comment.enabled} onChange={(event) => patchDraft({ comment: { ...draft.comment, enabled: event.target.checked } })} /> <span>Công tắc</span></label>
            </div>
            {draft.comment.enabled ? <>
              <div className="post-tabs post-tabs--small" role="tablist" aria-label="8 biến thể bình luận">
                {Array.from({ length: POST_TABS }, (_, index) => index + 1).map((tab) => <button type="button" key={tab} className={draft.comment.activeTab === tab ? "is-active" : ""} onClick={() => patchDraft({ comment: { ...draft.comment, activeTab: tab } })}>{tab}</button>)}
              </div>
              <textarea aria-label="Nội dung bình luận" placeholder="Nội dung bình luận..." value={draft.comment.contents[draft.comment.activeTab]?.text ?? ""} onChange={(event) => patchDraft({ comment: { ...draft.comment, contents: { ...draft.comment.contents, [draft.comment.activeTab]: { ...(draft.comment.contents[draft.comment.activeTab] ?? defaultComposer()), text: event.target.value } } } })} />
            </> : <p className="empty-state">Bật công tắc để thêm nội dung bình luận</p>}
          </section>

          <section className="post-card run-controls" data-testid="run-controls">
            <div className="interval-fields">
              <strong>Cách nhau:</strong>
              <label>Từ (giây)<input type="number" min={MIN_INTERVAL_SECONDS} value={draft.fromSec} onChange={(event) => patchDraft({ fromSec: Number(event.target.value) })} /></label>
              <label>Đến (giây)<input type="number" min={MIN_INTERVAL_SECONDS} value={draft.toSec} onChange={(event) => patchDraft({ toSec: Number(event.target.value) })} /></label>
              <span className="hint">(Chạy 1 lần 1 bài, tối thiểu 10 giây/lần)</span>
            </div>
            <label className="anti-spam"><strong>Né spam</strong><input type="checkbox" checked={draft.antiSpam} onChange={(event) => patchDraft({ antiSpam: event.target.checked })} /><span>{draft.antiSpam ? "Tối thiểu 60 giây/lần" : "Tắt"}</span></label>
            <button type="button" className="primary-button" onClick={() => void start()} disabled={busy} data-testid="start-post">{busy ? "Đang xử lý..." : "Bắt Đầu"}</button>
            {jobId ? <output className="job-receipt" data-testid="job-receipt">Mock job: {jobId}</output> : null}
          </section>
        </section>

        <aside className="post-page__aside">
          <section className="post-card aside-card">
            <h2>Bộ sưu tập</h2>
            <p className="empty-state">Chọn nhóm để lưu bộ sưu tập yêu thích.</p>
            <button type="button" onClick={() => notify({ kind: "info", text: "Bộ sưu tập nhóm được lưu qua API nhóm" })}>Lưu bộ sưu tập</button>
          </section>
          <section className="post-card aside-card">
            <h2>Quản lý bài</h2>
            <div className="stack-actions">
              <button type="button" onClick={() => notify({ kind: "info", text: "Lọc: Tất cả" })}>Tất cả</button>
              <button type="button" onClick={() => notify({ kind: "info", text: "Lọc: Chờ duyệt" })}>Chờ duyệt</button>
              <button type="button" onClick={() => notify({ kind: "info", text: "Lọc: Đã đăng" })}>Đã đăng</button>
            </div>
            <label className="switch-label"><input type="checkbox" checked={draft.leaveGroupAfterPost} onChange={(event) => patchDraft({ leaveGroupAfterPost: event.target.checked })} /> <span>Rời nhóm</span></label>
          </section>
        </aside>
      </section>

      {showTemplates ? <div className="template-drawer" role="dialog" aria-label="Thư viện mẫu">
        <div className="template-drawer__header"><h2>Thư viện mẫu</h2><button type="button" onClick={() => setShowTemplates(false)}>Đóng</button></div>
        <div className="template-save-row"><input placeholder="Tên mẫu" value={templateName} onChange={(event) => setTemplateName(event.target.value)} /><button type="button" onClick={() => void saveTemplate()}>Lưu mẫu</button></div>
        {templates.length ? <ul>{templates.map((template) => <li key={template.id}><button type="button" onClick={() => selectTemplate(template)}>{template.name}</button></li>)}</ul> : <p className="empty-state">Chưa có mẫu</p>}
      </div> : null}
      {toast ? <div className={`toast toast--${toast.kind}`} role="status">{toast.text}</div> : null}
    </main>
  );
}

function ComposerEditor({ value, onChange, onMention }: { value: ComposerState; onChange: (patch: Partial<ComposerState>) => void; onMention: (mode: MentionMode) => void }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const updateToggle = (key: keyof typeof DEFAULT_TOGGLES, checked: boolean) => onChange({ toggles: { ...value.toggles, [key]: checked } });
  return <div className="composer-editor">
    <textarea aria-label="Nội dung bài đăng" rows={5} placeholder="Bạn đang nghĩ gì?" value={value.text} onChange={(event) => onChange({ text: event.target.value })} />
    <div className="composer-toolbar">
      <button type="button" aria-label="Emoji" onClick={() => setEmojiOpen((open) => !open)}>☺</button>
      <button type="button" aria-label="Phông nền" onClick={() => onChange({ backgroundIds: value.backgroundIds.length ? [] : ["mock-background"] })}>▧</button>
      <label title="Tự động tag mọi người/nêu bật"><input type="checkbox" checked={value.toggles.autoTag} onChange={(event) => updateToggle("autoTag", event.target.checked)} /> Tự động tag</label>
      <label title="Tự động tắt định dạng mua bán"><input type="checkbox" checked={value.toggles.disableMarketplace} onChange={(event) => updateToggle("disableMarketplace", event.target.checked)} /> Tắt Marketplace</label>
      <label title="Tự động xáo trộn thứ tự media"><input type="checkbox" checked={value.toggles.shuffleMedia} onChange={(event) => updateToggle("shuffleMedia", event.target.checked)} /> Xáo trộn media</label>
      <select aria-label="Mention" value={value.toggles.mentionMode} onChange={(event) => onMention(event.target.value as MentionMode)}><option value="none">Không tag</option><option value="highlight">@nêu bật</option><option value="everyone">@mọi người</option></select>
    </div>
    {emojiOpen ? <div className="emoji-picker" role="listbox">{["😀", "🎉", "❤️", "👍", "🔥"].map((emoji) => <button type="button" key={emoji} onClick={() => { onChange({ text: `${value.text}${emoji}` }); setEmojiOpen(false); }}>{emoji}</button>)}</div> : null}
    {value.backgroundIds.length ? <p className="composer-hint">Đã chọn phông nền — không thể đính kèm ảnh/video hoặc link</p> : null}
  </div>;
}

function MediaPicker({ media, onFiles, onReorder, onRemove }: { media: MediaInput[]; onFiles: (files: FileList | null) => void; onReorder: (from: number, to: number) => void; onRemove: (id: string) => void }) {
  return <div className="media-picker">
    <label className="dropzone"><input type="file" multiple accept="image/*,video/mp4,.mp4" onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} /><strong>Hình ảnh/Video</strong><span>Kéo thả hoặc nhấn chọn ảnh / video MP4</span><small>Video chỉ hỗ trợ MP4 · dung lượng tối đa 500mb</small></label>
    {media.length ? <div className="media-list" aria-label="Media đã chọn">{media.map((file, index) => <div className="media-item" key={file.id}><span title={`${file.name} (${Math.round(file.sizeBytes / 1024)} KB)`}>{index + 1}. {file.name}</span><div><button type="button" disabled={index === 0} onClick={() => onReorder(index, index - 1)} aria-label={`Đưa ${file.name} lên`}>←</button><button type="button" disabled={index === media.length - 1} onClick={() => onReorder(index, index + 1)} aria-label={`Đưa ${file.name} xuống`}>→</button><button type="button" onClick={() => onRemove(file.id)} aria-label={`Xóa ${file.name}`}>×</button></div></div>)}</div> : null}
    <small className="media-limit">Giới hạn mỗi tệp: {Math.round(MAX_MEDIA_BYTES / (1024 * 1024))} MB</small>
  </div>;
}

function mergeDraft(base: PostDraft, patch?: Partial<PostDraft>): PostDraft {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    composers: { ...base.composers, ...(patch.composers ?? {}) },
    mediaByTab: { ...base.mediaByTab, ...(patch.mediaByTab ?? {}) },
    comment: { ...base.comment, ...(patch.comment ?? {}) },
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { errors?: Array<{ message?: string }>; error?: string };
    return body.errors?.map((error) => error.message).filter(Boolean).join("; ") || body.error || response.statusText;
  } catch {
    return response.statusText;
  }
}
