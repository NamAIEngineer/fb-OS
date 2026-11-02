import React, { useCallback, useEffect, useState } from "react";
import { GroupStatsTable } from "../pending/CampaignPage";

type GroupStat = { id: string; uid: string; name: string; memberCount: number; postsPerDay: number; newMembers: number; approvalRequired: boolean; isPublic: boolean; updatedAt: string };
type Collection = { id: string; name: string; groupIds: string[]; createdAt: string; updatedAt: string };

export default function GroupCollectionsPage({ apiBase = "/api", userId = "local-user" }: { apiBase?: string; userId?: string }) {
  const [groups, setGroups] = useState<GroupStat[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers); headers.set("accept", "application/json"); headers.set("x-user-id", userId);
    const response = await fetch(`${apiBase}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json() as Promise<T>;
  }, [apiBase, userId]);
  const refresh = useCallback(async () => {
    try { const [nextGroups, nextCollections] = await Promise.all([request<GroupStat[]>(`/group-stats?q=${encodeURIComponent(query)}`), request<Collection[]>("/group-collections")]); setGroups(nextGroups); setCollections(nextCollections); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tải bộ sưu tập"); }
  }, [query, request]);
  useEffect(() => { void refresh(); }, [refresh]);
  const save = async () => {
    if (!name.trim()) { setMessage("Nhập tên bộ sưu tập"); return; }
    try { await request("/group-collections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, groupIds: selected }) }); setName(""); setSelected([]); setMessage("Đã lưu bộ sưu tập"); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu"); }
  };
  return <main style={{ maxWidth: 1180, margin: "0 auto", padding: 24, background: "#f8fafc", minHeight: "100vh" }}><header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}><div><div style={{ color: "#6b7280", fontSize: 13 }}>GroupPilot · PRO</div><h1 style={{ margin: "4px 0 18px" }}>Bộ sưu tập nhóm</h1></div><button type="button" onClick={() => void refresh()}>Làm mới</button></header>{message && <div role="status" style={{ marginBottom: 12, padding: 10, background: "#fff7ed", color: "#9a3412" }}>{message}</div>}<section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 }}><strong>Tạo bộ sưu tập</strong><div style={{ display: "flex", gap: 8, marginTop: 10 }}><input aria-label="Tên bộ sưu tập" placeholder="Tên bộ sưu tập" value={name} onChange={(event) => setName(event.target.value)} style={{ flex: 1, padding: 8 }} /><button type="button" onClick={() => void save()}>Lưu</button></div>{collections.length > 0 && <ul>{collections.map((collection) => <li key={collection.id}>{collection.name} ({collection.groupIds.length} nhóm)</li>)}</ul>}</section><GroupStatsTable groups={groups} selected={selected} onSelectedChange={setSelected} query={query} onQueryChange={setQuery} onRefresh={() => void refresh()} onSave={() => void save()} onExport={() => { const csv = ["id,uid,name,memberCount,postsPerDay,newMembers,approvalRequired", ...groups.map((group) => [group.id, group.uid, group.name, group.memberCount, group.postsPerDay, group.newMembers, group.approvalRequired].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "group-collections.csv"; anchor.click(); URL.revokeObjectURL(url); }} /></main>;
}
