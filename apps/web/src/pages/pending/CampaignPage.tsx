import React, { useCallback, useEffect, useMemo, useState } from "react";

type CampaignStatus = "pending" | "fulfilled" | "rejected";
type CampaignPost = {
  id: string;
  groupName: string;
  content: string;
  mode: string;
  status: CampaignStatus;
  saved: boolean;
  createdAt: string;
  rejectionReason?: string;
};
type GroupStat = {
  id: string;
  uid: string;
  name: string;
  memberCount: number;
  postsPerDay: number;
  newMembers: number;
  approvalRequired: boolean;
  isPublic: boolean;
  updatedAt: string;
};

export interface CampaignPageProps {
  status?: CampaignStatus;
  apiBase?: string;
  userId?: string;
  plan?: "BASIC" | "PLUS" | "PRO" | "MAX";
}

const DEFAULT_POSTS: CampaignPost[] = [];
const DEFAULT_GROUPS: GroupStat[] = [];

function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    return response.json().catch(() => ({ error: `HTTP_${response.status}` })).then((body) => {
      throw new Error((body as { error?: string }).error ?? `HTTP_${response.status}`);
    });
  }
  return response.json() as Promise<T>;
}

function useCampaignApi(base: string, userId: string) {
  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers);
    headers.set("accept", "application/json");
    headers.set("x-user-id", userId);
    const response = await fetch(`${base}${path}`, { ...init, headers });
    return asJson<T>(response);
  }, [base, userId]);
  return request;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("vi-VN");
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  background: "#fff",
  padding: 16,
  boxShadow: "0 1px 2px rgb(0 0 0 / 4%)",
};

export function GroupStatsTable({
  groups,
  selected,
  onSelectedChange,
  query,
  onQueryChange,
  onRefresh,
  onSave,
  onExport,
}: {
  groups: GroupStat[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onSave: () => void;
  onExport: () => void;
}) {
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return groups
      .filter((group) => !needle || group.name.toLocaleLowerCase().includes(needle) || group.uid.includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, query]);
  const toggle = (id: string) => onSelectedChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  return <section style={cardStyle} aria-label="Bảng nhóm">
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
      <strong style={{ fontSize: 16 }}>Nhóm đã lưu</strong>
      <input aria-label="Tìm nhóm" placeholder="Tìm nhóm" value={query} onChange={(event) => onQueryChange(event.target.value)} style={{ flex: 1, minWidth: 180, padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }} />
      <button type="button" onClick={onRefresh}>Làm mới</button>
      <button type="button" onClick={onSave}>Lưu</button>
      <button type="button" onClick={onExport}>Xuất CSV</button>
    </div>
    {visible.length === 0 ? <div style={{ padding: "28px 8px", textAlign: "center", color: "#6b7280" }}>Chưa có nhóm</div> : <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["", "Tên nhóm", "TV nhóm", "Bài/ngày", "TV mới", "Duyệt bài"].map((heading) => <th key={heading} scope="col" style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>{heading}</th>)}</tr></thead>
        <tbody>{visible.map((group) => <tr key={group.id}>
          <td style={{ padding: 8 }}><input type="checkbox" aria-label={`Chọn ${group.name}`} checked={selected.includes(group.id)} onChange={() => toggle(group.id)} /></td>
          <td style={{ padding: 8 }}>{group.name}<div style={{ color: "#6b7280", fontSize: 12 }}>{group.uid}</div></td>
          <td style={{ padding: 8 }}>{group.memberCount.toLocaleString("vi-VN")}</td>
          <td style={{ padding: 8 }}>{group.postsPerDay}</td>
          <td style={{ padding: 8 }}>{group.newMembers}</td>
          <td style={{ padding: 8 }}>{group.approvalRequired ? "Có" : "Không"}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

export function CampaignPage({ status, apiBase = "/api", userId = "local-user", plan = "PRO" }: CampaignPageProps) {
  const request = useCampaignApi(apiBase, userId);
  const [posts, setPosts] = useState<CampaignPost[]>(DEFAULT_POSTS);
  const [groups, setGroups] = useState<GroupStat[]>(DEFAULT_GROUPS);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [deleteFilter, setDeleteFilter] = useState<"all" | "pending" | "fulfilled">("all");
  const [upCount, setUpCount] = useState(1);
  const [comment, setComment] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const path = status ? `/${status}` : "/campaigns";
      setPosts(await request<CampaignPost[]>(path));
      setMessage("");
    } catch (error) {
      const local = window.localStorage.getItem(`grouppilot:campaigns:${userId}`);
      setPosts(local ? JSON.parse(local) as CampaignPost[] : DEFAULT_POSTS);
      setMessage(error instanceof Error ? `${error.message} · đang dùng dữ liệu cục bộ` : "Đang dùng dữ liệu cục bộ");
    } finally { setLoading(false); }
  }, [request, status, userId]);

  const loadGroups = useCallback(async () => {
    try { setGroups(await request<GroupStat[]>(`/group-stats?q=${encodeURIComponent(search)}`)); }
    catch { setGroups(DEFAULT_GROUPS); }
  }, [request, search]);

  useEffect(() => { void loadPosts(); void loadGroups(); }, [loadPosts, loadGroups]);

  const runAction = async (path: string, body: Record<string, unknown>, label: string) => {
    if (!posts[0]) { setMessage("Chưa có bài để thực hiện"); return; }
    try {
      await request(path.replace(":id", posts[0].id), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setMessage(`${label}: đã ghi nhận`);
      await loadPosts();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể thực hiện"); }
  };

  const deletePosts = async () => {
    try {
      await request("/campaigns", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ filter: deleteFilter }) });
      setMessage(`Đã xóa: ${deleteFilter === "all" ? "Tất cả" : deleteFilter === "pending" ? "Chờ duyệt" : "Đã đăng"}`);
      await loadPosts();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể xóa bài"); }
  };

  const savePost = async (post: CampaignPost) => {
    try {
      await request(`/campaigns/${post.id}/save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ saved: !post.saved }) });
      await loadPosts();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu bài"); }
  };

  const exportGroups = () => {
    const rows = [["id", "uid", "name", "memberCount", "postsPerDay", "newMembers", "approvalRequired"], ...groups.map((group) => [group.id, group.uid, group.name, group.memberCount, group.postsPerDay, group.newMembers, group.approvalRequired])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = href; anchor.download = "groups.csv"; anchor.click(); URL.revokeObjectURL(href);
  };

  const orderedPosts = [...posts].sort((a, b) => sortAsc ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  return <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, background: "#f8fafc", minHeight: "100vh", color: "#111827" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
      <div><div style={{ color: "#6b7280", fontSize: 13 }}>GroupPilot · {plan}</div><h1 style={{ margin: "4px 0", fontSize: 26 }}>{status === "pending" ? "Bài chờ duyệt" : status === "fulfilled" ? "Bài đã đăng" : status === "rejected" ? "Bài bị từ chối" : "Chiến dịch"}</h1></div>
      <button type="button" onClick={() => { void loadPosts(); void loadGroups(); }} disabled={loading}>Làm mới</button>
    </header>
    {message && <div role="status" style={{ marginBottom: 12, padding: 10, borderRadius: 6, background: "#fff7ed", color: "#9a3412" }}>{message}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, 1fr)", gap: 16, alignItems: "start" }}>
      <section style={cardStyle} aria-label="Danh sách bài viết">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}><strong style={{ fontSize: 16 }}>Bài viết</strong><button type="button" onClick={() => setSortAsc((value) => !value)}>Sắp xếp {sortAsc ? "mới nhất" : "cũ nhất"}</button></div>
        {orderedPosts.length === 0 ? <div style={{ padding: "32px 8px", textAlign: "center", color: "#6b7280" }}>Chưa có bài viết</div> : <div style={{ display: "grid", gap: 10 }}>{orderedPosts.map((post) => <article key={post.id} style={{ border: "1px solid #e5e7eb", borderRadius: 7, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>{post.groupName}</strong><span style={{ color: post.status === "rejected" ? "#b91c1c" : "#4b5563" }}>{post.status}</span></div>
          <p style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{post.content}</p>
          <small style={{ color: "#6b7280" }}>{post.mode} · {formatDate(post.createdAt)}{post.rejectionReason ? ` · ${post.rejectionReason}` : ""}</small>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}><button type="button" onClick={() => void savePost(post)}>{post.saved ? "Đã lưu" : "Lưu bài"}</button><button type="button" onClick={() => void runAction("/bump/:id", { upCount }, "Úp bài")}>Úp bài</button><button type="button" onClick={() => void runAction("/comment-outreach/:id", { text: comment }, "Bình luận dạo")}>Bình luận dạo</button><button type="button" onClick={() => void runAction("/share-link/:id", { url: link }, "Chia sẻ link")}>Chia sẻ link</button><button type="button" onClick={() => void runAction("/profile-post-share/:id", { groupId: selectedGroups[0] }, "Chia sẻ bài cá nhân vào nhóm")}>Chia sẻ vào nhóm</button></div>
        </article>)}</div>}
      </section>
      <aside style={{ display: "grid", gap: 16 }}>
        <section style={cardStyle} aria-label="Chiến dịch"><strong>Thao tác chiến dịch</strong><label style={{ display: "grid", gap: 4, marginTop: 12 }}>Số lần úp<input type="number" min={1} max={100} value={upCount} onChange={(event) => setUpCount(Math.max(1, Number(event.target.value) || 1))} /></label><label style={{ display: "grid", gap: 4, marginTop: 8 }}>Nội dung bình luận<textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Nhập bình luận" /></label><label style={{ display: "grid", gap: 4, marginTop: 8 }}>Đường dẫn chia sẻ<input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://" /></label></section>
        <section style={cardStyle} aria-label="Xóa bài"><strong>Xóa bài</strong><div style={{ display: "flex", gap: 8, marginTop: 10 }}><select value={deleteFilter} onChange={(event) => setDeleteFilter(event.target.value as typeof deleteFilter)}><option value="all">Tất cả</option><option value="pending">Chờ duyệt</option><option value="fulfilled">Đã đăng</option></select><button type="button" onClick={() => void deletePosts()}>Xóa</button></div></section>
      </aside>
    </div>
    <div style={{ marginTop: 16 }}><GroupStatsTable groups={groups} selected={selectedGroups} onSelectedChange={setSelectedGroups} query={search} onQueryChange={setSearch} onRefresh={() => void loadGroups()} onSave={() => setMessage(`Đã chọn ${selectedGroups.length} nhóm`)} onExport={exportGroups} /></div>
  </main>;
}

export default CampaignPage;
