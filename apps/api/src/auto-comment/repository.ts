import {
  AutoCommentReceipt,
  AutoCommentScript,
  AutoCommentScriptInput,
  AutoCommentStore,
  localId,
  nowIso,
  normalizeKeyword,
} from "../../../../packages/shared/contracts-interactions.js";

export class InMemoryAutoCommentStore implements AutoCommentStore {
  private readonly scripts = new Map<string, AutoCommentScript[]>();
  private readonly receipts = new Map<string, AutoCommentReceipt[]>();

  async listScripts(accountId: string, search?: string): Promise<AutoCommentScript[]> {
    const needle = search ? normalizeKeyword(search) : "";
    return structuredClone(
      (this.scripts.get(accountId) ?? []).filter((script) => {
        if (!needle) return true;
        return normalizeKeyword(script.name).includes(needle) || script.keywords.some((keyword) => normalizeKeyword(keyword).includes(needle));
      }),
    );
  }

  async getScript(accountId: string, scriptId: string): Promise<AutoCommentScript | undefined> {
    const script = (this.scripts.get(accountId) ?? []).find((candidate) => candidate.id === scriptId);
    return script ? structuredClone(script) : undefined;
  }

  async saveScript(accountId: string, input: AutoCommentScriptInput, scriptId?: string): Promise<AutoCommentScript> {
    const timestamp = nowIso();
    const current = this.scripts.get(accountId) ?? [];
    const existing = scriptId ? current.find((candidate) => candidate.id === scriptId) : undefined;
    const script: AutoCommentScript = {
      id: existing?.id ?? scriptId ?? localId("auto_comment_script"),
      name: input.name.trim(),
      keywords: [...new Set(input.keywords.map((keyword) => keyword.trim()).filter(Boolean))],
      tabContents: structuredClone(input.tabContents),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    if (existing) current[current.indexOf(existing)] = script;
    else current.unshift(script);
    this.scripts.set(accountId, current);
    return structuredClone(script);
  }

  async deleteScript(accountId: string, scriptId: string): Promise<boolean> {
    const current = this.scripts.get(accountId) ?? [];
    const next = current.filter((script) => script.id !== scriptId);
    this.scripts.set(accountId, next);
    return current.length !== next.length;
  }

  async listReceipts(accountId: string): Promise<AutoCommentReceipt[]> {
    return structuredClone(this.receipts.get(accountId) ?? []);
  }

  async saveReceipt(receipt: AutoCommentReceipt): Promise<AutoCommentReceipt> {
    const current = this.receipts.get(receipt.accountId) ?? [];
    current.unshift(structuredClone(receipt));
    this.receipts.set(receipt.accountId, current);
    return structuredClone(receipt);
  }
}
