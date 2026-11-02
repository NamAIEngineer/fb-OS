import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppLayout } from '../layout';
import { PlansPage } from '../pages/plans';
import { AuthPage } from '../pages/auth';
import { ProfilePage } from '../pages/profile';
import { AffiliatePage } from '../pages/affiliate';
import { PostPage } from '../pages/post';
import { AccountsPage } from '../pages/accounts';
import { JoinGroupPage } from '../pages/join-group';
import BumpPage from '../pages/bump';
import { InteractPage } from '../pages/interact';
import { AutoCommentPage } from '../pages/auto-comment';
import { AutoApprovePage } from '../pages/auto-approve';
import { GroupLibraryPage } from '../pages/group-library';
import GroupCollectionsPage from '../pages/group-collections';
import CommentCollectionsPage from '../pages/comment-collections';
import FriendCollectionsPage from '../pages/friend-collections';
import PendingPage from '../pages/pending';
import FulfilledPage from '../pages/fulfilled';
import RejectedPage from '../pages/rejected';
import { PagesInboxPage } from '../pages/pages-inbox';
import AutoCommentScriptTemplatesPage from '../pages/auto-comment-script-templates';

function HealthProbe() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'offline'>('checking');
  useEffect(() => {
    fetch('/api/health').then((response) => response.ok ? setStatus('ok') : setStatus('offline')).catch(() => setStatus('offline'));
  }, []);
  useEffect(() => {
    const element = document.getElementById('api-health');
    if (!element) return;
    element.textContent = status === 'ok' ? 'API sẵn sàng' : status === 'offline' ? 'API chưa kết nối' : 'API đang kiểm tra';
    element.classList.toggle('ok', status === 'ok');
  }, [status]);
  return null;
}

function GuardedApp() {
  const navigate = useNavigate();
  useEffect(() => {
    const publicPaths = ['/plans', '/login', '/register'];
    if (!localStorage.getItem('grouppilot_token') && !publicPaths.includes(window.location.pathname)) navigate('/login', { replace: true });
  }, [navigate]);
  return <><HealthProbe /><Routes>
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/plans" element={<PlansPage />} />
    <Route element={<AppLayout />}>
      <Route path="/post" element={<PostPage planTier="PRO" />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/join-group" element={<JoinGroupPage />} />
      <Route path="/bump" element={<BumpPage />} />
      <Route path="/interact" element={<InteractPage />} />
      <Route path="/auto-comment" element={<AutoCommentPage />} />
      <Route path="/auto-approve" element={<AutoApprovePage />} />
      <Route path="/group-library" element={<GroupLibraryPage />} />
      <Route path="/group-collections" element={<GroupCollectionsPage />} />
      <Route path="/comment-collections" element={<CommentCollectionsPage />} />
      <Route path="/friend-collections" element={<FriendCollectionsPage />} />
      <Route path="/auto-comment-script-templates" element={<AutoCommentScriptTemplatesPage />} />
      <Route path="/pending" element={<PendingPage />} />
      <Route path="/fulfilled" element={<FulfilledPage />} />
      <Route path="/rejected" element={<RejectedPage />} />
      <Route path="/pages-inbox" element={<PagesInboxPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/affiliate" element={<AffiliatePage />} />
      <Route path="*" element={<Navigate to="/post" replace />} />
    </Route>
  </Routes></>;
}

export function AppRouter() { return <BrowserRouter><GuardedApp /></BrowserRouter>; }
