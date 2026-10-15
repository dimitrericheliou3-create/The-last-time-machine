import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Search, Plus, Clock3, LayoutDashboard, BookOpen, Users, Settings, LogOut, ImagePlus,
  ChevronDown, Command, Lightbulb, ShieldCheck, Zap, X, Check,
  CircleHelp, Filter, MoreHorizontal, Pencil, Trash2, Menu, ArrowRight,
  FileText, Activity, LockKeyhole, Mail, Eye, EyeOff, RotateCcw,
  UserRound, Camera, AtSign, Save, Home, Folder, Bell, ChevronRight, Globe,
  Shield, Wifi, Briefcase, Tag, Crown
} from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } }) : null;
const TERMS_VERSION = '2026-10-13';
const PRIVACY_VERSION = '2026-10-13';
const FREE_SOLUTION_LIMIT = 10;
const TEAM_SOLUTION_LIMIT = 500;
const BUSINESS_INCLUDED_SOLUTIONS = 2500;
const BUSINESS_EXTRA_SOLUTION_MONTHLY_PRICE = 0.05;

const moneyForOverage = (amount) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);

function personNameFromEmail(email) {
  const localPart = String(email || '').split('@')[0].trim();
  if (!localPart) return 'My';
  return localPart.charAt(0).toLocaleUpperCase() + localPart.slice(1);
}

function initials(value) {
  const parts = String(value || 'U').trim().split(/[\s.@_-]+/).filter(Boolean);
  return parts.slice(0,2).map(part=>part.charAt(0).toUpperCase()).join('') || 'U';
}


function BrandClock({ size = 20 }) {
  return <span className="brand-clock" style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" focusable="false">
      <circle className="brand-clock-face" cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.7"/>
      <path className="brand-clock-ticks" d="M12 4.2v1.4M19.8 12h-1.4M12 19.8v-1.4M4.2 12h1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <line className="brand-clock-hour-hand" x1="12" y1="12" x2="14.8" y2="9.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line className="brand-clock-minute-hand" x1="12" y1="12" x2="12" y2="6.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="1.25" fill="currentColor"/>
    </svg>
  </span>;
}

function workspaceDisplayName(name, ownerId, user, displayName) {
  const rawName = String(name || '').trim();
  if (!rawName) return 'Your workspace';
  const emailName = String(user?.email || '').split('@')[0].trim();
  if (!emailName || ownerId !== user?.id || rawName.toLocaleLowerCase() !== `${emailName} workspace`.toLocaleLowerCase()) return rawName;
  const ownerName = String(displayName || '').trim() || personNameFromEmail(user.email);
  return `${ownerName} workspace`;
}

const demoSolutions = [
  { id:'demo-1', title:'Payment not going through', category:'Payments', problem_description:'A customer payment fails even though the card appears valid.', steps:['Confirm the card is active and has sufficient funds.','Check that the billing address matches the card details.','Clear the checkout cache and retry once.','If it still fails, contact the payment provider with the error code.'], outcome:'Payment succeeded after clearing the checkout cache.', created_at:new Date(Date.now()-86400000*2).toISOString(), demo:true },
  { id:'demo-2', title:'Customer can’t log in', category:'Account Access', problem_description:'A customer is locked out after several unsuccessful login attempts.', steps:['Verify the customer email address.','Check whether the account is temporarily locked.','Send a password reset link.','Confirm the customer can log in and remind them to use a password manager.'], outcome:'Customer regained access after resetting their password.', created_at:new Date(Date.now()-86400000*4).toISOString(), demo:true },
  { id:'demo-3', title:'Inventory not syncing', category:'Inventory', problem_description:'Stock levels in the online store do not match the warehouse count.', steps:['Check the last successful sync timestamp.','Verify the product SKU matches in both systems.','Retry the sync for the affected items.','Escalate persistent failures with the sync job ID.'], outcome:'Corrected the SKU mapping and ran a successful sync.', created_at:new Date(Date.now()-86400000*7).toISOString(), demo:true },
  { id:'demo-4', title:'Order confirmation email missing', category:'Email', problem_description:'A customer placed an order but did not receive a confirmation email.', steps:['Check the order status and email address.','Look in the email provider logs for a bounce or block.','Check spam and suppression lists.','Resend the confirmation after correcting the issue.'], outcome:'Removed the address from the suppression list and resent the email.', created_at:new Date(Date.now()-86400000*9).toISOString(), demo:true }
];

async function attachImageUrls(items) {
  if (!supabase || !Array.isArray(items)) return items || [];
  return Promise.all(items.map(async (item) => {
    if (!item.image_path) return { ...item, image_url: null };
    const { data, error } = await supabase.storage.from('solution-images').createSignedUrl(item.image_path, 3600);
    return { ...item, image_url: error ? null : data?.signedUrl || null };
  }));
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [availableWorkspaces, setAvailableWorkspaces] = useState([]);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createWorkspaceName, setCreateWorkspaceName] = useState('');
  const [createWorkspaceError, setCreateWorkspaceError] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [themeKey, setThemeKey] = useState('dark');
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeError, setThemeError] = useState('');
  const [themeMessage, setThemeMessage] = useState('');

  useEffect(() => {
    const themeColors = {
      dark: '#f5f7fb',
      midnight: '#081321',
      forest: '#0a1712',
      plum: '#110d1b',
      light: '#f7f5ef'
    };
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', themeColors[themeKey] || themeColors.dark);
  }, [themeKey]);
  const workspaceMenuRef = useRef(null);
  const [hasPaidPlan, setHasPaidPlan] = useState(false);
  const [activePlanKey, setActivePlanKey] = useState('starter');
  const [myWorkspacePermissions, setMyWorkspacePermissions] = useState({can_create_solutions:false, can_edit_solutions:false, can_delete_solutions:false});
  const [solutions, setSolutions] = useState(demoSolutions);
  const [loadingData, setLoadingData] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const [category, setCategory] = useState('__all__');
  const [sortOrder, setSortOrder] = useState('recent');
  const [activeNav, setActiveNav] = useState('Dashboard');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [solutionReviewSaving, setSolutionReviewSaving] = useState(false);
  const [solutionReviewError, setSolutionReviewError] = useState('');
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [inviteActionLoading, setInviteActionLoading] = useState(false);
  const [inviteActionError, setInviteActionError] = useState('');
  // Preserve the workspace just joined when the invitation token is removed from the URL.
  const preferredWorkspaceIdRef = useRef(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setAuthLoading(false); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Record meaningful foreground activity for the account inactivity policy.
  // The database RPC rate-limits writes to at most once per hour per account.
  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    let alive = true;
    const recordActivity = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.rpc('record_user_activity').then(({error}) => {
        if (alive && error) console.warn('Could not record account activity:', error.message);
      }).catch(error => {
        if (alive) console.warn('Could not record account activity:', error?.message || error);
      });
    };
    recordActivity();
    document.addEventListener('visibilitychange', recordActivity);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', recordActivity);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let alive = true;
    async function loadProfile() {
      if (!supabase || !session?.user?.id) {
        setProfile(null);
        setProfileLoadError('');
        setThemeKey('dark');
        setThemeError('');
        setThemeMessage('');
        return;
      }
      setProfileLoading(true);
      setProfileLoadError('');
      try {
        const { data, error } = await supabase.from('profiles')
          .select('user_id,display_name,email,username,bio,avatar_path,theme_key,updated_at')
          .eq('user_id', session.user.id).single();
        if (error) throw error;
        let avatarUrl = null;
        if (data.avatar_path) {
          const { data: signed, error: signedError } = await supabase.storage.from('profile-avatars').createSignedUrl(data.avatar_path, 3600);
          if (!signedError) avatarUrl = signed?.signedUrl || null;
        }
        if (alive) {
          const savedTheme = ['dark','midnight','forest','plum','light'].includes(data.theme_key) ? data.theme_key : 'dark';
          setThemeKey(savedTheme);
          setProfile({ ...data, theme_key: savedTheme, avatarUrl });
        }
      } catch (e) {
        if (alive) {
          setProfileLoadError(e.message || 'Could not load your profile.');
          setThemeKey('dark');
          setProfile({
            user_id: session.user.id,
            display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Workspace member',
            email: session.user.email,
            username: null,
            bio: null,
            avatar_path: null,
            theme_key: 'dark',
            avatarUrl: null
          });
        }
      } finally {
        if (alive) setProfileLoading(false);
      }
    }
    loadProfile();
    return () => { alive = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('invite');
    if (token) setInviteToken(token);
  }, [session]);

  useEffect(() => { if (session?.user && !inviteToken) loadWorkspace(session.user); else if (!session) { setWorkspace(null); setAvailableWorkspaces([]); setWorkspaceMenuOpen(false); setSolutions(demoSolutions); setMyWorkspacePermissions({can_create_solutions:false, can_edit_solutions:false, can_delete_solutions:false}); } }, [session, inviteToken]);

  async function acceptWorkspaceInvite() {
    if (!supabase || !session?.user || !inviteToken) return;
    setInviteActionLoading(true); setInviteActionError('');
    try {
      const { data, error } = await supabase.functions.invoke('workspace-invitations', { body: { action: 'accept', token: inviteToken } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success || !data?.workspace?.id) throw new Error('The invitation response was incomplete. Please ask the owner to send a new invitation.');
      preferredWorkspaceIdRef.current = data.workspace.id;
      const { data: joinedWorkspace, error: joinedWorkspaceError } = await supabase.from('workspaces')
        .select('id,name,owner_id,created_at,solution_review_enabled').eq('id', data.workspace.id).single();
      if (joinedWorkspaceError) throw joinedWorkspaceError;
      setWorkspace({ ...joinedWorkspace, membershipRole: 'member' });
      setWorkspaceName(joinedWorkspace.name || '');
      const { data: subscriptionRow } = await supabase.from('workspace_subscriptions').select('plan_key,status').eq('workspace_id', data.workspace.id).maybeSingle();
      const activePlan = subscriptionRow?.status === 'active' ? subscriptionRow.plan_key : 'starter';
      setActivePlanKey(activePlan);
      setHasPaidPlan(['team','business'].includes(activePlan));
      const { data: solutionRows, error: solutionError } = await supabase.from('solutions').select('*').eq('workspace_id', data.workspace.id).order('updated_at', { ascending: false });
      if (solutionError) throw solutionError;
      setSolutions(await attachImageUrls(solutionRows || []));
      window.history.replaceState({}, '', window.location.pathname);
      setInviteToken('');
      notify(`You joined ${data.workspace.name || 'the workspace'}.`);
    } catch (e) { setInviteActionError(e.message || 'Could not accept invitation.'); }
    finally { setInviteActionLoading(false); }
  }


  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    if (!workspaceMenuOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!workspaceMenuRef.current?.contains(event.target)) setWorkspaceMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setWorkspaceMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [workspaceMenuOpen]);

  async function loadWorkspace(user, requestedWorkspaceId = null) {
    if (!supabase || !user?.id) return false;
    setLoadingData(true);
    try {
      const { data: memberships, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, joined_at, workspaces(id,name,owner_id,created_at,solution_review_enabled)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true });
      if (memberError) throw memberError;

      // Keep every workspace the signed-in user belongs to, not just the first one.
      const workspaceOptions = (memberships || []).map((row) => {
        const related = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
        return related?.id ? { ...related, membershipRole: row.role || 'member' } : null;
      }).filter(Boolean);

      const preferredId = requestedWorkspaceId || preferredWorkspaceIdRef.current;
      if (preferredId && !workspaceOptions.some((item) => item.id === preferredId)) {
        throw new Error('You no longer have access to that workspace. Ask its owner to invite you again.');
      }

      let current = preferredId
        ? workspaceOptions.find((item) => item.id === preferredId)
        : workspaceOptions[0];

      if (!current && preferredId) {
        throw new Error('That workspace could not be found in your memberships.');
      }

      if (!current) {
        const { data: created, error: createError } = await supabase.from('workspaces')
          .insert({ name: `${personNameFromEmail(user.email)} workspace`, owner_id: user.id })
          .select('id,name,owner_id,created_at,solution_review_enabled').single();
        if (createError) throw createError;
        // The database trigger creates the owner's membership row. Add the new workspace
        // to the local list immediately so the picker is correct on the first visit.
        current = { ...created, membershipRole: 'owner' };
        workspaceOptions.push(current);
      }

      if (preferredWorkspaceIdRef.current) preferredWorkspaceIdRef.current = null;

      const isOwner = current.owner_id === user.id;
      const permissionQuery = isOwner
        ? Promise.resolve({ data: { can_create_solutions: true, can_edit_solutions: true, can_delete_solutions: true }, error: null })
        : supabase.from('workspace_member_permissions')
            .select('can_create_solutions,can_edit_solutions,can_delete_solutions')
            .eq('workspace_id', current.id).eq('user_id', user.id).maybeSingle();

      const [permissionResult, subscriptionResult, solutionResult] = await Promise.all([
        permissionQuery,
        supabase.from('workspace_subscriptions').select('plan_key,status').eq('workspace_id', current.id).maybeSingle(),
        supabase.from('solutions').select('*').eq('workspace_id', current.id).order('updated_at', { ascending: false })
      ]);
      if (permissionResult.error) throw permissionResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (solutionResult.error) throw solutionResult.error;

      const permissionRow = permissionResult.data;
      const subscriptionRow = subscriptionResult.data;
      const activePlan = subscriptionRow?.status === 'active' ? subscriptionRow.plan_key : 'starter';
      const decoratedSolutions = await attachImageUrls(solutionResult.data || []);

      // Commit the new workspace and all of its related data together, so the UI
      // cannot accidentally show the previous workspace's solutions under the new name.
      setAvailableWorkspaces(workspaceOptions);
      setWorkspace(current);
      setWorkspaceName(current.name || '');
      setMyWorkspacePermissions({
        can_create_solutions: !!permissionRow?.can_create_solutions,
        can_edit_solutions: !!permissionRow?.can_edit_solutions,
        can_delete_solutions: !!permissionRow?.can_delete_solutions
      });
      setActivePlanKey(activePlan);
      setHasPaidPlan(['team', 'business'].includes(activePlan));
      setSolutions(decoratedSolutions);
      setAuthError('');
      return true;
    } catch (e) {
      setAuthError(e.message || 'Could not load workspace.');
      // If the first load fails, don't leave demo data looking like real workspace data.
      if (!workspace) setSolutions([]);
      return false;
    } finally {
      setLoadingData(false);
    }
  }

  async function createWorkspace() {
    const name = createWorkspaceName.trim().replace(/\s+/g, ' ');
    setCreateWorkspaceError('');
    if (!name || name.length > 120) {
      setCreateWorkspaceError('Workspace name must be between 1 and 120 characters.');
      return;
    }
    if (!supabase || !session?.user?.id) {
      setCreateWorkspaceError('Sign in before creating a workspace.');
      return;
    }
    setCreatingWorkspace(true);
    try {
      const { data, error } = await supabase.from('workspaces')
        .insert({ name, owner_id: session.user.id })
        .select('id,name,owner_id,created_at,solution_review_enabled').single();
      if (error) throw error;

      // Supabase's workspace trigger creates the owner membership automatically.
      setCreateWorkspaceOpen(false);
      setCreateWorkspaceName('');
      setWorkspaceMenuOpen(false);
      const loaded = await loadWorkspace(session.user, data.id);
      if (loaded) {
        setActiveNav('Solutions');
        setQuery('');
        setCategory('__all__');
        setSortOrder('recent');
        notify(`Created ${data.name}`);
      } else {
        notify(`Created ${data.name}. Refresh if it doesn't appear in the workspace list yet.`);
      }
    } catch (e) {
      setCreateWorkspaceError(e.message || 'Could not create the workspace.');
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function changeTheme(nextTheme) {
    const validThemes = ['dark','midnight','forest','plum','light'];
    if (!validThemes.includes(nextTheme) || nextTheme === themeKey || themeSaving) return;
    if (!supabase || !session?.user?.id) {
      setThemeError('Sign in to save your color scheme to your account.');
      return;
    }
    const previousTheme = themeKey;
    setThemeKey(nextTheme);
    setThemeSaving(true);
    setThemeError('');
    setThemeMessage('');
    try {
      const { data, error } = await supabase.from('profiles')
        .update({ theme_key: nextTheme })
        .eq('user_id', session.user.id)
        .select('theme_key').single();
      if (error) throw error;
      const savedTheme = validThemes.includes(data?.theme_key) ? data.theme_key : nextTheme;
      setThemeKey(savedTheme);
      setProfile(current => current ? { ...current, theme_key: savedTheme } : current);
      setThemeMessage('Saved to your account.');
      notify('Color scheme saved');
    } catch (e) {
      setThemeKey(previousTheme);
      setThemeError(e.message || 'Could not save the color scheme. Your previous theme has been restored.');
      setThemeMessage('');
    } finally {
      setThemeSaving(false);
    }
  }

  async function saveProfile(payload) {
    if (!supabase || !session?.user?.id) throw new Error('Sign in before editing your profile.');
    const displayName = String(payload.displayName || '').trim();
    const username = String(payload.username || '').trim().replace(/^@/, '').toLowerCase();
    const bio = String(payload.bio || '').trim();
    if (!displayName || displayName.length > 80) throw new Error('Display name must be between 1 and 80 characters.');
    if (username && !/^[a-z0-9._-]{3,24}$/.test(username)) {
      throw new Error('Username must be 3–24 characters using letters, numbers, dots, underscores, or hyphens.');
    }
    if (bio.length > 160) throw new Error('Bio must be 160 characters or fewer.');

    setProfileSaving(true);
    let uploadedPath = null;
    const oldPath = profile?.avatar_path || null;
    try {
      let avatarPath = payload.removeAvatar ? null : oldPath;
      if (payload.avatarFile) {
        const mimeToExtension = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif' };
        const extension = mimeToExtension[payload.avatarFile.type];
        if (!extension) throw new Error('Use a JPG, PNG, WebP, or GIF profile picture.');
        if (payload.avatarFile.size > 5 * 1024 * 1024) throw new Error('Profile pictures must be 5 MB or smaller.');
        uploadedPath = `${session.user.id}/avatar-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(uploadedPath, payload.avatarFile, {
          upsert: false,
          contentType: payload.avatarFile.type
        });
        if (uploadError) throw uploadError;
        avatarPath = uploadedPath;
      }

      const { data, error } = await supabase.from('profiles').update({
        display_name: displayName,
        username: username || null,
        bio: bio || null,
        avatar_path: avatarPath
      }).eq('user_id', session.user.id)
        .select('user_id,display_name,email,username,bio,avatar_path,theme_key,updated_at').single();
      if (error) {
        if (error.code === '23505') throw new Error('That username is already taken. Try another one.');
        if (error.code === '23514') throw new Error('Check the username or bio length and try again.');
        throw error;
      }

      let avatarUrl = null;
      if (data.avatar_path) {
        const { data: signed, error: signedError } = await supabase.storage.from('profile-avatars').createSignedUrl(data.avatar_path, 3600);
        if (!signedError) avatarUrl = signed?.signedUrl || null;
      }
      const nextProfile = { ...data, avatarUrl };
      setProfile(nextProfile);
      if (oldPath && oldPath !== avatarPath) {
        const { error: removeError } = await supabase.storage.from('profile-avatars').remove([oldPath]);
        if (removeError) console.warn('Old profile picture could not be removed:', removeError.message);
      }
      notify('Profile saved');
      return nextProfile;
    } catch (e) {
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('profile-avatars').remove([uploadedPath]);
        if (cleanupError) console.warn('New profile picture cleanup failed:', cleanupError.message);
      }
      throw e;
    } finally {
      setProfileSaving(false);
    }
  }

  async function switchWorkspace(nextWorkspace) {
    if (!nextWorkspace?.id || nextWorkspace.id === workspace?.id || switchingWorkspace) {
      setWorkspaceMenuOpen(false);
      return;
    }
    setWorkspaceMenuOpen(false);
    setSwitchingWorkspace(true);
    setSelected(null);
    setModal(null);
    const switched = await loadWorkspace(session.user, nextWorkspace.id);
    setSwitchingWorkspace(false);
    if (switched) {
      setActiveNav('Solutions');
      setQuery('');
      setCategory('__all__');
      setSortOrder('recent');
      setMobileNav(false);
      notify(`Switched to ${nextWorkspace.name || 'workspace'}`);
    } else {
      notify('Could not switch workspaces. Your previous workspace is still selected.');
    }
  }

  async function submitAuth(e) {
    e.preventDefault(); setAuthError(''); setAuthMessage('');
    if (!supabase) { setAuthError('App configuration is missing. Follow the README setup steps.'); return; }
    setSaving(true);
    try {
      if (authMode === 'signup') {
        if (!legalAccepted) throw new Error('Please accept the Terms of Service and Privacy Policy to create an account.');
        const {data,error} = await supabase.auth.signUp({email:authEmail.trim(),password:authPassword, options:{emailRedirectTo:window.location.origin, data:{legal_terms_version:TERMS_VERSION, legal_privacy_version:PRIVACY_VERSION, legal_accepted_at:new Date().toISOString()}}});
        if (error) throw error;
        if (!data.session) setAuthMessage('Check your email and confirm your address. This page will sign you in and open your workspace automatically.');
        else setAuthMessage('Account created! Setting up your workspace…');
      } else {
        const {error} = await supabase.auth.signInWithPassword({email:authEmail.trim(),password:authPassword});
        if (error) throw error;
      }
    } catch (e) { setAuthError(e.message || 'Authentication failed.'); }
    finally { setSaving(false); }
  }

  async function signOut() { await supabase?.auth.signOut(); setRecoveryMode(false); setActiveNav('Solutions'); setAuthEmail(''); }

  async function saveRecoveredPassword(e) {
    e.preventDefault(); setAuthError(''); setAuthMessage('');
    if (recoveryPassword.length < 8) { setAuthError('Use at least 8 characters for your new password.'); return; }
    if (recoveryPassword !== recoveryPasswordConfirm) { setAuthError('The passwords do not match.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) throw error;
      setRecoveryMode(false); setRecoveryPassword(''); setRecoveryPasswordConfirm('');
      setAuthMessage('Password updated successfully.'); notify('Password updated');
    } catch (e) { setAuthError(e.message || 'Could not update password.'); }
    finally { setSaving(false); }
  }

  async function requestPasswordReset() {
    setAuthError(''); setAuthMessage('');
    if (!supabase) { setAuthError('App configuration is missing.'); return; }
    if (!authEmail.trim()) { setAuthError('Enter your email address first, then choose reset password.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: window.location.origin
      });
      if (error) throw error;
      setAuthMessage('If an account exists for that email, a password-reset link has been sent.');
    } catch (e) { setAuthError(e.message || 'Could not request a password reset.'); }
    finally { setSaving(false); }
  }

  async function saveWorkspaceName(e) {
    e.preventDefault(); setSettingsError(''); setSettingsMessage('');
    const clean = workspaceName.trim();
    if (!clean || clean.length > 120) { setSettingsError('Workspace name must be between 1 and 120 characters.'); return; }
    if (!workspace || !supabase) { setSettingsError('Workspace is not available.'); return; }
    if (workspace.owner_id !== session?.user?.id) {
      setSettingsError('Only the workspace owner can change the workspace name. Ask the owner to update it in Settings.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('workspaces').update({ name: clean }).eq('id', workspace.id).select().single();
      if (error) throw error;
      setWorkspace(data);
      setAvailableWorkspaces(prev => prev.map(item => item.id === data.id ? { ...item, ...data } : item));
      setSettingsMessage('Workspace name updated.');
      notify('Workspace settings saved');
    } catch (e) { setSettingsError(e.message || 'Could not update workspace.'); }
    finally { setSaving(false); }
  }

  async function toggleSolutionReview(enabled) {
    setSolutionReviewError('');
    if (!supabase || !workspace?.id) {
      setSolutionReviewError('Workspace is not available.');
      return;
    }
    if (workspace.owner_id !== session?.user?.id) {
      setSolutionReviewError('Only the workspace owner can change this setting.');
      return;
    }
    if (enabled && activePlanKey !== 'business') {
      setSolutionReviewError('Solution review requires an active Business plan.');
      return;
    }
    setSolutionReviewSaving(true);
    try {
      const { data, error } = await supabase.from('workspaces')
        .update({ solution_review_enabled: enabled })
        .eq('id', workspace.id)
        .select('id,name,owner_id,created_at,solution_review_enabled').single();
      if (error) throw error;
      setWorkspace(current => current?.id === data.id ? { ...current, ...data } : current);
      setAvailableWorkspaces(previous => previous.map(item => item.id === data.id ? { ...item, ...data } : item));
      notify(enabled
        ? 'Solution review is on. New and edited solutions need approval.'
        : 'Solution review is off. Pending solutions are now approved.');
    } catch (e) {
      setSolutionReviewError(e.message || 'Could not update the solution review setting.');
    } finally {
      setSolutionReviewSaving(false);
    }
  }

  async function deleteAccount() {
    if (!supabase || !session?.access_token) return;
    const confirmation = prompt('This permanently deletes your account. Type DELETE to confirm. If you own a workspace with other members, transfer ownership first.');
    if (confirmation !== 'DELETE') return;
    setDeletingAccount(true); setDeleteAccountError('');
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: 'DELETE' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await supabase.auth.signOut().catch(() => {});
      window.location.href = window.location.pathname;
    } catch (e) { setDeleteAccountError(e.message || 'Account deletion failed. Please contact support.'); }
    finally { setDeletingAccount(false); }
  }

  function exportSolutions() {
    // Neutralize spreadsheet formulas while preserving ordinary CSV quoting.
    const csvCell = (value) => {
      let text = String(value ?? '');
      if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const rows = [
      ['Title','Category','Problem','Steps to fix','Outcome','Created','Last updated'],
      ...solutions.map(s => [s.title, s.category || 'General', s.problem_description || '', (s.steps || []).join('\n'), s.outcome || '', s.created_at || '', s.updated_at || s.created_at || ''])
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'last-time-machine-solutions.csv';
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Solutions exported to CSV');
  }

  useEffect(() => {
    function handleSearchShortcut(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === searchInputRef.current) {
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  const categoryOptions = useMemo(() => {
    const seen = new Map();
    solutions.forEach(s => { const label = String(s.category || 'General').trim().replace(/\s+/g, ' '); const key = label.toLocaleLowerCase(); if (label && !seen.has(key)) seen.set(key, label); });
    if (!seen.has('general')) seen.set('general', 'General');
    return [...seen.values()].sort((a,b) => a.localeCompare(b));
  }, [solutions]);
  const categories = categoryOptions;
  const solutionPlanName = activePlanKey === 'team' ? 'Team' : activePlanKey === 'business' ? 'Business' : 'Starter';
  const solutionUsageCap = activePlanKey === 'team' ? TEAM_SOLUTION_LIMIT : activePlanKey === 'business' ? BUSINESS_INCLUDED_SOLUTIONS : FREE_SOLUTION_LIMIT;
  const solutionUsagePercent = Math.min(100, Math.round((solutions.length / solutionUsageCap) * 100));
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const result = solutions.filter(s => {
      const text = [s.title,s.problem_description,s.category,s.outcome,...(s.steps||[])].join(' ').toLowerCase();
      return (!q || text.includes(q)) && (category === '__all__' || String(s.category || 'General').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === category.trim().replace(/\s+/g, ' ').toLocaleLowerCase());
    });
    return result.sort((a,b) => sortOrder === 'title'
      ? String(a.title || '').localeCompare(String(b.title || ''))
      : sortOrder === 'oldest'
        ? new Date(a.created_at || 0) - new Date(b.created_at || 0)
        : new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  }, [solutions, query, category, sortOrder]);

  async function saveSolution(payload) {
    setSaveError('');
    const solutionLimit = activePlanKey === 'team' ? TEAM_SOLUTION_LIMIT : activePlanKey === 'business' ? Infinity : FREE_SOLUTION_LIMIT;
    if (!payload.id && solutions.length >= solutionLimit) {
      setSaveError(activePlanKey === 'team'
        ? `The Team plan includes up to ${TEAM_SOLUTION_LIMIT} saved solutions per workspace. Upgrade to Business to keep adding solutions.`
        : `The free preview includes up to ${FREE_SOLUTION_LIMIT} saved solutions per workspace. Upgrade your plan to keep adding solutions.`);
      return;
    }
    if (!supabase || !session?.user) {
      setSaveError('You need to sign in and connect Supabase before saving real solutions.');
      return;
    }
    if (!workspace) {
      setSaveError('Your workspace has not finished loading. Refresh the page; if this continues, check the workspace error shown on the page.');
      return;
    }
    if (workspace.owner_id !== session.user.id) {
      if (payload.id && !myWorkspacePermissions.can_edit_solutions) {
        setSaveError('Your workspace owner has not granted you permission to edit solutions. You can still view and search the knowledge base.');
        return;
      }
      if (!payload.id && !myWorkspacePermissions.can_create_solutions) {
        setSaveError('Your workspace owner has not granted you permission to create solutions.');
        return;
      }
    }
    setSaving(true);
    let uploadedImagePath = null;
    try {
      let imagePath = payload.imagePath || null;
      if (payload.imageFile) {
        if (!['image/jpeg','image/png','image/webp','image/gif'].includes(payload.imageFile.type)) throw new Error('Use a JPG, PNG, WebP, or GIF image. SVG and other formats are not supported.');
        if (payload.imageFile.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
        const safeName = payload.imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        imagePath = `${workspace.id}/${payload.id || crypto.randomUUID()}-${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('solution-images').upload(imagePath, payload.imageFile, {
          upsert: false, contentType: payload.imageFile.type
        });
        if (uploadError) throw uploadError;
        uploadedImagePath = imagePath;
      }
      if (payload.id) {
        const {data,error} = await supabase.from('solutions').update({
          title:payload.title, problem_description:payload.problem_description, category:payload.category,
          steps:payload.steps, outcome:payload.outcome, image_path:imagePath
        }).eq('id',payload.id).select().single();
        if (error) throw error;
        if (payload.oldImagePath && payload.oldImagePath !== imagePath) {
          const { error: cleanupError } = await supabase.storage.from('solution-images').remove([payload.oldImagePath]);
          if (cleanupError) console.warn('Old solution image could not be removed:', cleanupError.message);
        }
        const decorated = (await attachImageUrls([data]))[0];
        setSolutions(prev=>prev.map(s=>s.id===decorated.id?decorated:s));
        notify(decorated.review_status === 'pending' ? 'Solution updated and submitted for review' : 'Solution updated');
      } else {
        const {data,error} = await supabase.from('solutions').insert({
          workspace_id:workspace.id, created_by:session.user.id, title:payload.title,
          problem_description:payload.problem_description, category:payload.category,
          steps:payload.steps, outcome:payload.outcome, image_path:imagePath
        }).select().single();
        if (error) throw error;
        const decorated = (await attachImageUrls([data]))[0];
        setSolutions(prev=>[decorated,...prev]);
        notify(decorated.review_status === 'pending' ? 'Solution submitted for review' : 'Solution saved to your workspace');
      }
      setModal(null); setSelected(null);
    } catch(e) {
      if (uploadedImagePath) {
        const { error: cleanupError } = await supabase.storage.from('solution-images').remove([uploadedImagePath]);
        if (cleanupError) console.warn('Uploaded image cleanup failed:', cleanupError.message);
      }
      const message = e?.message || 'Could not save solution';
      setSaveError(message);
      notify('Could not save solution — see the message in the form.');
    }
    finally { setSaving(false); }
  }

  async function deleteSolution(item) {
    if (supabase && item && !item.demo && workspace?.owner_id !== session?.user?.id && !myWorkspacePermissions.can_delete_solutions) {
      notify('Your workspace owner has not granted you permission to delete solutions.');
      return;
    }
    if (!confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    if (!supabase || item.demo) {
      setSolutions(prev => prev.filter(s => s.id !== item.id));
      setSelected(null); setModal(null);
      notify('Demo solution removed');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('solutions').delete().eq('id', item.id);
      if (error) throw error;
      if (item.image_path) {
        const { error: imageError } = await supabase.storage.from('solution-images').remove([item.image_path]);
        if (imageError) console.warn('Deleted solution image could not be removed:', imageError.message);
      }
      setSolutions(prev => prev.filter(s => s.id !== item.id));
      setSelected(null); setModal(null);
      notify('Solution deleted');
    } catch (e) {
      notify(e.message || 'Could not delete solution');
    } finally {
      setSaving(false);
    }
  }

  const canReviewSolutions = !!workspace && (workspace.owner_id === session?.user?.id || workspace.membershipRole === 'admin');
  async function reviewSolution(item, decision) {
    if (!supabase || !item?.id || !['approved', 'changes_requested'].includes(decision)) return;
    if (activePlanKey !== 'business' || !workspace?.solution_review_enabled) {
      notify('Solution review requires an enabled Business plan setting.');
      return;
    }
    if (!canReviewSolutions) {
      notify('Only workspace owners and admins can review solutions.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('solutions')
        .update({ review_status: decision })
        .eq('id', item.id)
        .select().single();
      if (error) throw error;
      const decorated = (await attachImageUrls([data]))[0];
      setSolutions(previous => previous.map(solution => solution.id === decorated.id ? decorated : solution));
      setSelected(decorated);
      notify(decision === 'approved' ? 'Solution approved and published' : 'Changes requested — this solution remains hidden from the team');
    } catch (e) {
      notify(e.message || 'Could not update the solution review.');
    } finally {
      setSaving(false);
    }
  }

  const canCreateSolution = !supabase || workspace?.owner_id===session?.user?.id || myWorkspacePermissions.can_create_solutions;
  const canEditSolution = !supabase || workspace?.owner_id===session?.user?.id || myWorkspacePermissions.can_edit_solutions;
  const canDeleteSolution = !supabase || workspace?.owner_id===session?.user?.id || myWorkspacePermissions.can_delete_solutions;
  const legalPath = {
    '/terms': 'terms',
    '/privacy': 'privacy',
    '/acceptable-use': 'acceptable-use'
  }[window.location.pathname.replace(/\/+$/, '') || '/'];
  const legalView = legalPath || new URLSearchParams(window.location.search).get('legal');
  if (legalView === 'terms' || legalView === 'privacy' || legalView === 'acceptable-use') return <LegalPage page={legalView} />;
  if (authLoading) return <div className="loading-screen"><div className="brand-mark"><BrandClock size={24}/></div><span>Warming up the time machine…</span></div>;
  if (recoveryMode && session) return <PasswordRecoveryScreen password={recoveryPassword} setPassword={setRecoveryPassword} confirm={recoveryPasswordConfirm} setConfirm={setRecoveryPasswordConfirm} submit={saveRecoveredPassword} message={authMessage} error={authError} saving={saving} />;
  if (!session) return <AuthScreen configured={!!supabase} onResetPassword={requestPasswordReset} mode={authMode} setMode={setAuthMode} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} showPassword={showPassword} setShowPassword={setShowPassword} submit={submitAuth} message={authMessage} error={authError} saving={saving} legalAccepted={legalAccepted} setLegalAccepted={setLegalAccepted} />;
  if (inviteToken) return <div className="loading-screen"><div className="auth-card" style={{maxWidth:480, width:'calc(100% - 32px)', padding:32}}><div className="auth-card-icon"><Users size={22}/></div><div className="auth-overline">WORKSPACE INVITATION</div><h2>Join a team workspace</h2><p>Accepting this invitation will add the signed-in, email-confirmed account to the invited workspace. Invitation links expire after seven days and can only be used by the invited email address.</p>{inviteActionError&&<div className="form-error" role="alert">{inviteActionError}</div>}<button className="primary-btn" style={{width:'100%',justifyContent:'center'}} onClick={acceptWorkspaceInvite} disabled={inviteActionLoading}>{inviteActionLoading?'Verifying invitation…':'Accept invitation'}</button><button className="secondary-btn" style={{width:'100%',justifyContent:'center',marginTop:10}} onClick={()=>{window.history.replaceState({},'',window.location.pathname);setInviteToken('');}} disabled={inviteActionLoading}>Not now</button></div></div>;

  return <div className="app-shell" data-theme={themeKey}>
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
      <div className="brand"><div className="brand-mark"><BrandClock size={20}/></div><div className="brand-name">The Last <span>Time Machine</span><small>REAL PROBLEMS. REAL FIXES.</small></div><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <nav className="main-nav" aria-label="Primary navigation">
        <button className={`nav-item ${activeNav==='Dashboard'?'active':''}`} onClick={()=>{setActiveNav('Dashboard');setMobileNav(false);}}><Home size={19}/><span>Dashboard</span></button>
        <button className={`nav-item ${activeNav==='Solutions'?'active':''}`} onClick={()=>{setActiveNav('Solutions');setMobileNav(false);}}><Lightbulb size={19}/><span>Solutions</span>{solutions.length>0&&<span className="nav-count">{solutions.length}</span>}</button>
        <div className="workspace-picker workspace-picker-nav" ref={workspaceMenuRef}>
          <button
            type="button"
            className={`nav-item workspace-switch workspace-nav-trigger ${workspaceMenuOpen ? 'is-open active' : ''}`}
            onClick={() => setWorkspaceMenuOpen(open => !open)}
            aria-label="Choose workspace"
            aria-haspopup="true"
            aria-expanded={workspaceMenuOpen}
            disabled={switchingWorkspace}
          >
            <Folder size={19}/>
            <span>Workspace</span>
            <ChevronDown size={14} className="workspace-chevron" />
          </button>
        {workspaceMenuOpen && <div className="workspace-menu" role="menu" aria-label="Your workspaces">
          <div className="workspace-menu-heading">
            <strong>Your workspaces</strong>
            <span>{availableWorkspaces.length} {availableWorkspaces.length === 1 ? 'workspace' : 'workspaces'}</span>
          </div>
          {availableWorkspaces.map((item) => {
            const active = item.id === workspace?.id;
            const roleLabel = item.owner_id === session.user.id ? 'Owner' : 'Member';
            return <button
              type="button"
              role="menuitem"
              key={item.id}
              className={`workspace-option ${active ? 'active' : ''}`}
              aria-current={active ? 'true' : undefined}
              disabled={switchingWorkspace || active}
              onClick={() => switchWorkspace(item)}
            >
              <span className="workspace-option-avatar">{(item.name || 'W').slice(0,1).toUpperCase()}</span>
              <span className="workspace-option-copy">
                <strong>{workspaceDisplayName(item.name, item.owner_id, session.user, profile?.display_name)}</strong>
                <small>{roleLabel}{active ? ' · Current workspace' : ''}</small>
              </span>
              {active ? <Check size={16} className="workspace-option-check" /> : <ArrowRight size={15} className="workspace-option-arrow" />}
            </button>;
          })}
          {availableWorkspaces.length === 0 && <p className="workspace-menu-empty">No workspaces found for this account.</p>}
          <button type="button" className="workspace-create-option" onClick={() => {
            setWorkspaceMenuOpen(false);
            setCreateWorkspaceError('');
            setCreateWorkspaceName('');
            setCreateWorkspaceOpen(true);
          }}>
            <span className="workspace-create-icon"><Plus size={16}/></span>
            <span><strong>Create workspace</strong><small>Start a separate knowledge base</small></span>
          </button>
          <div className="workspace-menu-foot">Each workspace has its own solutions, team access, and plan.</div>
        </div>}
        </div>
        <button className={`nav-item ${activeNav==='Team'?'active':''}`} onClick={()=>{setActiveNav('Team');setMobileNav(false);}}><Users size={19}/><span>Team</span></button>
        <button className={`nav-item ${activeNav==='Plans'?'active':''}`} onClick={()=>{setActiveNav('Plans');setMobileNav(false);}}><Crown size={19}/><span>Plans</span></button>
        <div className="nav-divider" role="separator"/>
        <button className={`nav-item ${activeNav==='Settings'?'active':''}`} onClick={()=>{setActiveNav('Settings');setWorkspaceName(workspace?.name||'');setSettingsMessage('');setSettingsError('');setMobileNav(false);}}><Settings size={19}/><span>Settings</span></button>
        <button className="nav-item" onClick={()=>{setMobileNav(false);window.location.href='mailto:richelieureserved@gmail.com?subject=The%20Last%20Time%20Machine%20support';}}><CircleHelp size={19}/><span>Help</span></button>
      </nav>      <div className="sidebar-bottom">
        <div className="profile-row profile-row-static">
          <span className="profile-avatar">{profile?.avatarUrl?<img src={profile.avatarUrl} alt=""/>:initials(profile?.display_name||session.user.email||'U')}</span>
          <span className="profile-info"><strong>{profile?.display_name||session.user.email?.split('@')[0]}</strong><span>{activePlanKey==='team'?'Team Plan':activePlanKey==='business'?'Business Plan':'Free Plan'}</span></span>
          
        </div>
      </div>
    </aside>
    {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)} aria-label="Open navigation"><Menu size={20}/></button>
        {activeNav==='Dashboard' ? <label className="dashboard-global-search"><Search size={18}/><input ref={searchInputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search solutions..." aria-label="Search solutions"/><kbd>Ctrl K</kbd></label> : <div className="crumb">Workspace <span>/</span> <strong>{activeNav}</strong></div>}
        <div className="top-actions">
          {activeNav!=='Dashboard'&&<div className="secure-pill"><ShieldCheck size={15}/> Private workspace</div>}
          <button type="button" className="icon-btn top-notifications" aria-label="Notifications" onClick={()=>notify('You’re all caught up.')}><Bell size={19}/></button>
          <button type="button" className={`top-avatar top-avatar-button ${activeNav==='Profile'?'active':''}`} aria-label="Open profile" onClick={()=>{setActiveNav('Profile');setMobileNav(false);}}>{profile?.avatarUrl?<img src={profile.avatarUrl} alt=""/>:initials(profile?.display_name||session.user.email||'U')}</button>
        </div>
      </header>
      <div className={"page-content " + (activeNav === "Dashboard" ? "dashboard-page-content" : "")}>
        {authError && <div className="form-error" role="alert" style={{marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span>{authError}</span><button type="button" className="icon-btn" aria-label="Dismiss error" onClick={()=>setAuthError('')}><X size={16}/></button></div>}
        {activeNav==='Dashboard' ? <Dashboard
            solutions={solutions}
            workspace={workspace}
            session={session}
            displayName={profile?.display_name||session.user.email?.split('@')[0]||'there'}
            query={query}
            setQuery={setQuery}
            onNew={()=>{if(!canCreateSolution){setActiveNav('Plans');notify(activePlanKey==='team'?`Team plan limit reached: ${TEAM_SOLUTION_LIMIT} solutions per workspace.`:`Free preview limit reached: ${FREE_SOLUTION_LIMIT} solutions per workspace.`);return;}setSelected(null);setSaveError('');setModal({kind:'new'});}}
            onCreateWorkspace={()=>{setCreateWorkspaceError('');setCreateWorkspaceName('');setCreateWorkspaceOpen(true);}}
            onBrowse={chosenCategory=>{setCategory(chosenCategory||'__all__');setQuery('');setActiveNav('Solutions');}}
            onOpenSolution={s=>{setSelected(s);setModal({kind:'view'});}}
            onEditSolution={s=>{setSelected(s);setModal({kind:'edit'});}}
            onDeleteSolution={deleteSolution}
            canCreate={canCreateSolution}
            canEdit={canEditSolution}
            canDelete={canDeleteSolution}
          /> :
          activeNav==='Team' ? <TeamPage workspace={workspace} session={session} notify={notify} /> :
          activeNav==='Plans' ? <PlansPage notify={notify} workspace={workspace} session={session} /> :
          activeNav==='Profile' ? <ProfilePage profile={profile} email={session.user.email} loading={profileLoading} loadError={profileLoadError} saving={profileSaving} onSave={saveProfile} notify={notify} /> :
          activeNav==='Settings' ? <SettingsPage workspace={workspace} activePlanKey={activePlanKey} canRenameWorkspace={workspace?.owner_id === session.user.id} workspaceName={workspaceName} setWorkspaceName={setWorkspaceName} onSave={saveWorkspaceName} saving={saving} message={settingsMessage} error={settingsError} onExport={exportSolutions} email={session.user.email} onSignOut={signOut} onDeleteAccount={deleteAccount} deletingAccount={deletingAccount} deleteAccountError={deleteAccountError} themeKey={themeKey} onThemeChange={changeTheme} themeSaving={themeSaving} themeError={themeError} themeMessage={themeMessage} onToggleSolutionReview={toggleSolutionReview} solutionReviewSaving={solutionReviewSaving} solutionReviewError={solutionReviewError} onViewPlans={()=>setActiveNav('Plans')} /> :
          <>
            <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR KNOWLEDGE BASE</div><h1>Solutions <span className="heading-count">{solutions.length}</span></h1><p className="page-subtitle">Every problem solved is a lesson worth keeping.</p><div className="solution-limit-note">{activePlanKey === 'team' ? `Team: ${Math.min(solutions.length, TEAM_SOLUTION_LIMIT)} / ${TEAM_SOLUTION_LIMIT} solutions` : activePlanKey === 'business' ? `Business: ${solutions.length.toLocaleString()} / ${BUSINESS_INCLUDED_SOLUTIONS.toLocaleString()} included solutions` : `Free preview: ${Math.min(solutions.length, FREE_SOLUTION_LIMIT)} / ${FREE_SOLUTION_LIMIT} solutions`}</div>{activePlanKey === 'business' && solutions.length > BUSINESS_INCLUDED_SOLUTIONS && <p className="page-subtitle">Estimated overage: {moneyForOverage((solutions.length - BUSINESS_INCLUDED_SOLUTIONS) * BUSINESS_EXTRA_SOLUTION_MONTHLY_PRICE)} / month for {solutions.length - BUSINESS_INCLUDED_SOLUTIONS} extra solution(s). Overage billing is not active in this preview.</p>}</div>{solutions.length>0&&<button className="primary-btn" onClick={()=>{if((activePlanKey==='starter'&&solutions.length>=FREE_SOLUTION_LIMIT)||(activePlanKey==='team'&&solutions.length>=TEAM_SOLUTION_LIMIT)){setActiveNav('Plans');notify(activePlanKey==='team'?`Team plan limit reached: ${TEAM_SOLUTION_LIMIT} solutions per workspace.`:`Free preview limit reached: ${FREE_SOLUTION_LIMIT} solutions per workspace.`);return;}setSelected(null);setSaveError('');setModal({kind:'new'});}}><Plus size={18}/> New solution</button>}</div>
            <div className="solutions-workspace-layout">
              <section className="solutions-main-column" aria-label="Solutions library">
            <div className="welcome-banner"><div className="welcome-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="welcome-clock"><RotateCcw size={25}/></div></div><div className="welcome-copy"><span className="banner-kicker">THE POWER OF NOT STARTING OVER</span><h2>You've solved it before.<br/><span>Find the fix in seconds.</span></h2><p>Document the hard-won knowledge your team shouldn't have to rediscover.</p></div></div>
            <div className="stats-row"><Stat icon={BookOpen} label="Saved solutions" value={solutions.length} tint="blue"/><Stat icon={Activity} label="Categories" value={new Set(solutions.map(s=>s.category||'General')).size} tint="violet"/><Stat icon={Clock3} label="Recently updated" value={solutions.filter(s=>Date.now()-new Date(s.updated_at||s.created_at).getTime()<86400000*7).length} tint="green"/></div>
            <div className="list-heading"><div><h2>Your team's fixes</h2><p>Search the knowledge your team has already earned.</p></div><span className="results-note">{filtered.length} {filtered.length===1?'result':'results'}</span></div>
            <div className="filter-bar"><div className="search-field"><Search size={18}/><input ref={searchInputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search problems, keywords, or steps…" aria-label="Search solutions"/><kbd><Command size={11}/> K</kbd></div><div className="select-wrap" title="Filter by category" onClick={e=>{if(e.target.tagName!=='SELECT'){const el=e.currentTarget.querySelector('select');el?.focus();try{el?.showPicker?.();}catch{}}}}><Filter size={16}/><select aria-label="Filter by category" value={category} onChange={e=>setCategory(e.target.value)}><option value="__all__">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown size={14}/></div><div className="select-wrap" title="Sort solutions" onClick={e=>{if(e.target.tagName!=='SELECT'){const el=e.currentTarget.querySelector('select');el?.focus();try{el?.showPicker?.();}catch{}}}}><Clock3 size={16}/><select aria-label="Sort solutions" value={sortOrder} onChange={e=>setSortOrder(e.target.value)}><option value="recent">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select><ChevronDown size={14}/></div></div>
            {loadingData ? <div className="empty-state"><div className="loader"/><h3>Loading your knowledge…</h3></div> :
              filtered.length===0 ? <div className="empty-state"><div className="empty-icon"><Search size={25}/></div>
<h3>{solutions.length===0&&!query&&category==='__all__'?'Your knowledge base is ready':'No matching fixes'}</h3>
<p>{solutions.length===0&&!query&&category==='__all__'?'Start with one useful fix so your team can reuse it next time.':'Try another keyword or clear your search and category filters.'}</p>
{solutions.length===0&&!query&&category==='__all__'
  ? <button className="primary-btn" onClick={()=>{setSelected(null);setSaveError('');setModal({kind:'new'});}}><Plus size={17}/> Add your first solution</button>
  : <button className="secondary-btn" onClick={()=>{setQuery('');setCategory('__all__');}}>Clear search and filters</button>}</div> :
              <div className="solution-grid">{filtered.map((s,i)=><SolutionCard key={s.id} item={s} index={i} onOpen={()=>{setSelected(s);setModal({kind:'view'});}} onEdit={()=>{setSelected(s);setModal({kind:'edit'});}} onDelete={()=>deleteSolution(s)} canEdit={canEditSolution} canDelete={canDeleteSolution}/>)}</div>}
            {!supabase&&<div className="demo-notice"><CircleHelp size={16}/><div><strong>Preview mode</strong><span>These are sample fixes. Add your Supabase settings to enable real accounts and persistent saving.</span></div></div>}
              </section>
              <aside className="solutions-context-rail" aria-label="Solution library tools">
                <section className="solutions-rail-card solutions-usage-card">
                  <div className="solutions-rail-title">
                    <span className="solutions-rail-icon"><Activity size={17}/></span>
                    <div><h2>Workspace usage</h2><p>Your knowledge at a glance</p></div>
                  </div>
                  <div className="solutions-usage-count"><strong>{solutions.length.toLocaleString()}</strong><span>/ {activePlanKey === 'business' ? BUSINESS_INCLUDED_SOLUTIONS.toLocaleString() : activePlanKey === 'team' ? TEAM_SOLUTION_LIMIT.toLocaleString() : FREE_SOLUTION_LIMIT.toLocaleString()}</span></div>
                  <div className="solutions-usage-track" role="progressbar" aria-label="Saved solutions allowance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={solutionUsagePercent}><span style={{width: solutionUsagePercent + '%'}}/></div>
                  <p className="solutions-usage-caption">{activePlanKey === 'business' && solutions.length > BUSINESS_INCLUDED_SOLUTIONS ? 'You’re above the included allowance. Overage billing is not active.' : Math.max(0,solutionUsageCap-solutions.length).toLocaleString() + ' included slots remaining on your ' + solutionPlanName + ' plan.'}</p>
                  <button type="button" className="solutions-rail-link" onClick={()=>setActiveNav('Plans')}>View plans <ChevronRight size={15}/></button>
                </section>

                <section className="solutions-rail-card">
                  <div className="solutions-rail-title">
                    <span className="solutions-rail-icon"><Folder size={17}/></span>
                    <div><h2>Browse categories</h2><p>Jump straight to a topic</p></div>
                  </div>
                  <div className="solutions-rail-categories">
                    <button type="button" className={'solutions-category-link ' + (category === '__all__' ? 'active' : '')} onClick={()=>{setCategory('__all__');setQuery('');}}>
                      <span className="solutions-category-dot all-categories-dot"/><span>All solutions</span><strong>{solutions.length}</strong>
                    </button>
                    {categories.slice(0,6).map(name=>{
                      const count=solutions.filter(s=>String(s.category||'General').trim().replace(/\s+/g,' ').toLocaleLowerCase()===String(name).trim().replace(/\s+/g,' ').toLocaleLowerCase()).length;
                      return <button key={name} type="button" className={'solutions-category-link ' + (String(category).toLocaleLowerCase()===String(name).toLocaleLowerCase()?'active':'')} onClick={()=>{setCategory(name);setQuery('');}}>
                        <span className="solutions-category-dot"/><span>{name}</span><strong>{count}</strong>
                      </button>;
                    })}
                    {!categories.length&&<p className="solutions-rail-empty">Saved fixes will be grouped here as your library grows.</p>}
                  </div>
                  {categories.length>6&&<button type="button" className="solutions-rail-link" onClick={()=>{setCategory('__all__');setQuery('');}}>View all categories <ChevronRight size={15}/></button>}
                </section>

                <section className="solutions-capture-card">
                  <span className="solutions-capture-icon"><Lightbulb size={20}/></span>
                  <h2>Keep the next fix</h2>
                  <p>Record what went wrong, the steps that worked, and the result—so nobody has to solve it twice.</p>
                </section>
              </aside>
            </div>
          </>}
      </div>
      <footer className="footer"><span className="footer-copy">© {new Date().getFullYear()} The Last Time Machine</span><div className="footer-right"><nav className="footer-legal" aria-label="Legal and policy pages"><a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a><a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a><a href="/acceptable-use" target="_blank" rel="noreferrer">Acceptable Use</a></nav><span className="footer-tagline"><LockKeyhole size={13}/> Your knowledge. Your workspace.</span></div></footer>
    </main>
    {createWorkspaceOpen&&<div className="modal-backdrop workspace-create-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!creatingWorkspace){setCreateWorkspaceOpen(false);setCreateWorkspaceError('');}}}>
      <div className="modal workspace-create-modal" role="dialog" aria-modal="true" aria-labelledby="create-workspace-title">
        <div className="modal-head"><div><span className="modal-kicker">NEW WORKSPACE</span><h2 id="create-workspace-title">Create a separate space</h2></div><button type="button" className="icon-btn" onClick={()=>{if(!creatingWorkspace){setCreateWorkspaceOpen(false);setCreateWorkspaceError('');}}} aria-label="Close create workspace"><X size={19}/></button></div>
        <form className="solution-form" onSubmit={e=>{e.preventDefault();createWorkspace();}}>
          <p className="workspace-create-explainer">Each workspace has its own solutions, team members, permissions, and plan. Your account can switch between all workspaces you belong to.</p>
          <label>Workspace name<input autoFocus value={createWorkspaceName} onChange={e=>setCreateWorkspaceName(e.target.value)} maxLength={120} required placeholder="e.g. Personal projects or Acme Support"/></label>
          {createWorkspaceError&&<div className="form-error" role="alert">{createWorkspaceError}</div>}
          <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>{setCreateWorkspaceOpen(false);setCreateWorkspaceError('');}} disabled={creatingWorkspace}>Cancel</button><button type="submit" className="primary-btn" disabled={creatingWorkspace}>{creatingWorkspace?<><span className="mini-spinner"/> Creating…</>:<><Plus size={16}/> Create workspace</>}</button></div>
        </form>
      </div>
    </div>}
    {modal&&<Modal kind={modal.kind} item={selected} categories={categoryOptions} onClose={()=>{setModal(null);setSelected(null);setSaveError('');}} onSave={saveSolution} error={saveError} onEdit={()=>{setSaveError('');setModal({kind:'edit'});}} onDelete={deleteSolution} onReview={reviewSolution} saving={saving} signedIn={!!session} canEdit={canEditSolution} canDelete={canDeleteSolution} canReview={canReviewSolutions} reviewEnabled={!!workspace?.solution_review_enabled} />}
    {toast&&<div className="toast"><Check size={17}/>{toast}</div>}
  </div>;
}

function PasswordRecoveryScreen({password,setPassword,confirm,setConfirm,submit,message,error,saving}) {
  return <div className="auth-shell"><div className="auth-left"><div className="brand auth-brand"><div className="brand-mark"><BrandClock size={20}/></div><div className="brand-name">The Last <span>Time Machine</span><small>REAL PROBLEMS. REAL FIXES.</small></div></div><div className="auth-hero"><div className="eyebrow"><span className="eyebrow-dot"/> ACCOUNT SECURITY</div><h1>Back in<br/><span>control.</span></h1><p>Choose a new password to secure your knowledge base account.</p></div></div><div className="auth-right"><div className="auth-card"><div className="auth-card-icon"><LockKeyhole size={21}/></div><div className="auth-overline">RESET PASSWORD</div><h2>Choose a new password</h2><p>Use at least 8 characters and avoid reusing a password from another site.</p><form className="auth-form" onSubmit={submit}><label>New password</label><div className="auth-input"><LockKeyhole size={17}/><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></div><label>Confirm new password</label><div className="auth-input"><LockKeyhole size={17}/><input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Enter it again"/></div>{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<button className="primary-btn auth-submit" disabled={saving}>{saving?'Updating…':'Update password'}<ArrowRight size={17}/></button></form><div className="auth-legal">If this link has expired, request another password-reset email.</div></div></div></div>;
}

function AuthScreen({configured,onResetPassword,mode,setMode,email,setEmail,password,setPassword,showPassword,setShowPassword,submit,message,error,saving,legalAccepted,setLegalAccepted}) {
  return <div className="auth-shell"><div className="auth-left"><div className="brand auth-brand"><div className="brand-mark"><BrandClock size={20}/></div><div className="brand-name">The Last <span>Time Machine</span><small>REAL PROBLEMS. REAL FIXES.</small></div></div><div className="auth-hero"><div className="eyebrow"><span className="eyebrow-dot"/> BUSINESS KNOWLEDGE, CAPTURED</div><h1>Stop solving<br/>the <span>same problem</span><br/>twice.</h1><p>Keep your team's best fixes in one searchable place. When the problem comes back, the answer is already here.</p><div className="auth-benefits"><div><div className="benefit-icon"><Search size={18}/></div><span><strong>Find it fast</strong><small>Search real solutions, not old chat threads.</small></span></div><div><div className="benefit-icon"><Users size={18}/></div><span><strong>Share team knowledge</strong><small>Help every teammate learn from every fix.</small></span></div><div><div className="benefit-icon"><Zap size={18}/></div><span><strong>Get back to work</strong><small>Less guesswork. More getting it done.</small></span></div></div></div><div className="auth-footnote"><ShieldCheck size={15}/> Built for the knowledge your business can't afford to lose.</div></div><div className="auth-right"><div className="auth-card"><div className="auth-card-icon"><LockKeyhole size={21}/></div><div className="auth-overline">YOUR KNOWLEDGE BASE</div><h2>{mode==='login'?'Welcome back':'Create your account'}</h2><p>{mode==='login'?'Sign in to pick up where your team left off.':'Start building a searchable record of every fix.'}</p>
    {!configured&&<div className="config-warning"><CircleHelp size={17}/><span>Supabase settings are needed before sign-in can work. Follow the README setup guide.</span></div>}
    <form onSubmit={submit} className="auth-form"><label>Email address</label><div className="auth-input"><Mail size={17}/><input type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)}/></div><label>Password</label><div className="auth-input"><LockKeyhole size={17}/><input type={showPassword?'text':'password'} required minLength={mode==='signup'?8:1} autoComplete={mode==='login'?'current-password':'new-password'} placeholder={mode==='signup'?'At least 8 characters':'Your password'} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='signup'&&<label className="legal-consent"><input type="checkbox" checked={legalAccepted} onChange={e=>setLegalAccepted(e.target.checked)} required/><span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and acknowledge the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>}{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<button className="primary-btn auth-submit" disabled={saving||!configured}>{saving?'Please wait…':mode==='login'?'Sign in':'Create account'}<ArrowRight size={17}/></button></form><div className="auth-switch">{mode==='login'&&<button type="button" onClick={onResetPassword} disabled={saving}>Forgot password?</button>} {mode==='login'?'New to The Last Time Machine?':'Already have an account?'} <button onClick={()=>{setMode(mode==='login'?'signup':'login');}}>{mode==='login'?'Create account':'Sign in'}</button></div><div className="auth-legal"><a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a> · <a href="/acceptable-use" target="_blank" rel="noreferrer">Acceptable Use</a><br/>By signing up, you agree to the terms and acknowledge the privacy notice.</div></div><div className="auth-bottom"><span>© {new Date().getFullYear()} The Last Time Machine</span><span>Privacy-first by design</span></div></div></div>;
}

function Stat({icon:Icon,label,value,tint}) { return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong></div></div>; }

function SolutionCard({item,index,onOpen,onEdit,onDelete,canEdit=true,canDelete=true}) {
  const colors=['blue','violet','green','amber'];
  const iconMap={Payments:'↗','Account Access':'◎',Inventory:'▦',Email:'✉'};
  function handlePointerMove(event) {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    event.currentTarget.style.setProperty('--pointer-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${y * 100}%`);
    event.currentTarget.style.setProperty('--tilt-x', `${(0.5 - y) * 4}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${(x - 0.5) * 5}deg`);
  }
  function resetPointer(event) {
    event.currentTarget.style.setProperty('--pointer-x', '50%');
    event.currentTarget.style.setProperty('--pointer-y', '50%');
    event.currentTarget.style.setProperty('--tilt-x', '0deg');
    event.currentTarget.style.setProperty('--tilt-y', '0deg');
  }
  return <article className="solution-card" onPointerMove={handlePointerMove} onPointerLeave={resetPointer} style={{animationDelay:`${index*55}ms`}}><div className="solution-card-top"><div className={`category-icon ${colors[index%colors.length]}`}>{iconMap[item.category]||<FileText size={18}/>}</div><div className="card-actions">{canEdit&&<button className="icon-btn" onClick={onEdit} title="Edit solution" aria-label={`Edit ${item.title}`}><MoreHorizontal size={19}/></button>}{canDelete&&<button className="icon-btn delete-card-btn" onClick={onDelete} title="Delete solution" aria-label={`Delete ${item.title}`}><Trash2 size={17}/></button>}</div></div><div className="solution-category">{item.category||'General'}</div><button className="solution-title" onClick={onOpen}>{item.title}</button>{item?.review_status&&item.review_status!=='approved'&&<div className={`solution-review-badge status-${item.review_status}`}>{item.review_status==='pending'?'Pending review':'Changes requested'}</div>}<p className="solution-description">{item.problem_description||'No problem description added yet.'}</p>{item.image_url&&<img className="solution-card-image" src={item.image_url} alt={`Reference for ${item.title}`} loading="lazy" />}<div className="solution-card-bottom"><div className="last-fixed"><Clock3 size={14}/><span>Updated {timeAgo(item.updated_at||item.created_at)}</span></div></div></article>;
}

function Dashboard({solutions,workspace,session,displayName,query,setQuery,onNew,onCreateWorkspace,onBrowse,onOpenSolution,onEditSolution,onDeleteSolution,canCreate=true,canEdit=true,canDelete=true}) {
  const [teamCount,setTeamCount] = useState(1);
  useEffect(() => {
    let alive = true;
    async function loadTeamCount() {
      if (!supabase || !workspace?.id) {
        setTeamCount(session?.user?.id ? 1 : 0);
        return;
      }
      try {
        const {count,error} = await supabase.from('workspace_members')
          .select('user_id',{count:'exact',head:true})
          .eq('workspace_id',workspace.id);
        if (error) throw error;
        if (alive) setTeamCount(count ?? 1);
      } catch {
        if (alive) setTeamCount(1);
      }
    }
    loadTeamCount();
    return () => { alive = false; };
  }, [workspace?.id,session?.user?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = String(displayName || 'there').trim().split(/\s+/)[0] || 'there';
  const sorted = [...solutions].sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0));
  const categoryMap = solutions.reduce((map,item)=>{
    const name = String(item.category||'General').trim() || 'General';
    map.set(name,(map.get(name)||0)+1);
    return map;
  },new Map());
  const categories = [...categoryMap.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
  const recentFixes = solutions.filter(item=>{
    const stamp = new Date(item.updated_at||item.created_at||0).getTime();
    return Number.isFinite(stamp) && Date.now()-stamp < 7*86400000;
  }).length;
  const searchTerm = String(query||'').trim().toLowerCase();
  const matching = searchTerm ? sorted.filter(item=>
    [item.title,item.problem_description,item.category,...(item.steps||[])].some(value=>String(value||'').toLowerCase().includes(searchTerm))
  ) : sorted;
  const recent = matching.slice(0,5);
  const categoryTone = name => {
    const value=String(name||'').toLowerCase();
    if(/network|internet|wifi|wi-fi|connection/.test(value)) return 'violet';
    if(/account|security|password|access/.test(value)) return 'orange';
    if(/software|system|setup|install/.test(value)) return 'teal';
    if(/technology|hardware|camera|device|inventory|payment/.test(value)) return 'green';
    return 'blue';
  };
  const categoryIcon = name => {
    const value=String(name||'').toLowerCase();
    if(/network|internet|wifi|wi-fi|connection/.test(value)) return Globe;
    if(/account|security|password|access/.test(value)) return Shield;
    if(/software|system|setup|install/.test(value)) return Settings;
    if(/technology|hardware|camera|device|inventory/.test(value)) return Briefcase;
    if(/payment|billing/.test(value)) return Activity;
    if(/email|message/.test(value)) return Mail;
    return Lightbulb;
  };
  const timeLabel = value => {
    if(!value) return 'Recently';
    const stamp = new Date(value).getTime();
    if(!Number.isFinite(stamp)) return 'Recently';
    const days = Math.max(0,Math.floor((Date.now()-stamp)/86400000));
    if(days===0) return 'Today';
    if(days===1) return 'Yesterday';
    if(days<7) return `${days} days ago`;
    if(days<14) return '1 week ago';
    if(days<30) return `${Math.floor(days/7)} weeks ago`;
    return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  };
  const quickActions = [
    {title:'Add a Solution',description:'Save a new fix or guide',Icon:Lightbulb,onClick:onNew,tone:'blue',disabled:!canCreate},
    {title:'Create Workspace',description:'Organize your solutions',Icon:Folder,onClick:onCreateWorkspace,tone:'blue'},
  ];
  return <div className="dashboard-layout">
    <section className="dashboard-main-column" aria-label="Dashboard overview">
      <div className="dashboard-greeting">
        <div>
          <h1>{greeting}, {firstName}</h1>
          <p>Find and manage your time-saving solutions. Let's make today more efficient.</p>
        </div>
      </div>
      <div className="dashboard-stats-grid">
        <div className="dashboard-metric-card">
          <span className="dashboard-metric-icon metric-blue"><Lightbulb size={22}/></span>
          <span className="dashboard-metric-label">Total Solutions</span>
          <strong>{solutions.length}</strong>
          <small>Your saved solutions</small>
        </div>
        <div className="dashboard-metric-card">
          <span className="dashboard-metric-icon metric-green"><Folder size={22}/></span>
          <span className="dashboard-metric-label">Categories</span>
          <strong>{categoryMap.size}</strong>
          <small>Organized by topic</small>
        </div>
        <div className="dashboard-metric-card">
          <span className="dashboard-metric-icon metric-purple"><Users size={22}/></span>
          <span className="dashboard-metric-label">Team Members</span>
          <strong>{teamCount}</strong>
          <small>In your workspace</small>
        </div>
        <div className="dashboard-metric-card">
          <span className="dashboard-metric-icon metric-orange"><Clock3 size={22}/></span>
          <span className="dashboard-metric-label">Recent Fixes</span>
          <strong>{recentFixes}</strong>
          <small>Last 7 days</small>
        </div>
      </div>

      <section className="dashboard-recent-section">
        <div className="dashboard-section-heading">
          <div><h2>Recent Solutions</h2><p>{searchTerm ? `Matches for “${query}”` : 'Your team\'s latest problem-solving wins.'}</p></div>
          
        </div>
        <div className="dashboard-recent-list">
          {recent.length ? recent.map((item,index)=>{
            const category = item.category || 'General';
            const Icon = categoryIcon(category);
            const tone = categoryTone(category);
            return <article className="dashboard-solution-row" key={item.id}>
              <span className={`dashboard-row-icon tone-${tone}`} aria-hidden="true"><Icon size={22}/></span>
              <div className="dashboard-row-content">
                <button className="dashboard-row-title" type="button" onClick={()=>onOpenSolution(item)}>{item.title}</button>
                <p>{item.problem_description || 'Open this solution to see the recorded fix and steps.'}</p>
                <button type="button" className={`dashboard-category-pill tone-${tone}`} onClick={()=>onBrowse(category)}>{category}</button>
              </div>
              <span className="dashboard-row-time">{timeLabel(item.updated_at||item.created_at)}</span>
              {canEdit&&<button type="button" className="icon-btn dashboard-row-more" aria-label={`Edit ${item.title}`} title="Edit solution" onClick={()=>onEditSolution(item)}><MoreHorizontal size={18}/></button>}
            </article>;
          }) : <div className="dashboard-recent-empty"><Search size={22}/><strong>No matching solutions</strong><span>Try another search or view all your saved fixes.</span><button className="secondary-btn" type="button" onClick={()=>{setQuery('');onBrowse();}}>Clear search</button></div>}
        </div>
      </section>
    </section>

    <aside className="dashboard-rail" aria-label="Quick actions and workspace overview">
      <section className="dashboard-quote-card">
        <div className="dashboard-quote-copy">
          <p>“The best time to solve a problem is before it becomes one.”</p>
          <span>— The Last Time Machine</span>
        </div>
      </section>

      <section className="dashboard-side-card">
        <h2><Zap size={19}/> Quick Actions</h2>
        <div className="dashboard-quick-actions">
          {quickActions.map(({title,description,Icon,onClick,tone,disabled})=><button type="button" className="dashboard-quick-action" key={title} onClick={onClick} disabled={disabled}>
            <span className={`dashboard-quick-icon tone-${tone}`}><Icon size={21}/></span>
            <span className="dashboard-quick-copy"><strong>{title}</strong><small>{description}</small></span>
            <ChevronRight size={17} className="dashboard-quick-chevron"/>
          </button>)}
        </div>
      </section>

      <section className="dashboard-side-card dashboard-categories-card">
        <h2><Tag size={19}/> Categories</h2>
        <div className="dashboard-category-list">
          {categories.slice(0,4).map(([name,count])=>{
            const Icon=categoryIcon(name);
            const tone=categoryTone(name);
            return <button type="button" className="dashboard-category-row" key={name} onClick={()=>onBrowse(name)}>
              <span className={`dashboard-category-row-icon tone-${tone}`}><Icon size={15}/></span>
              <span className="dashboard-category-name">{name}</span>
              <span className={`dashboard-category-count tone-${tone}`}>{count}</span>
              <ChevronRight size={15} className="dashboard-quick-chevron"/>
            </button>;
          })}
          {!categories.length&&<p className="dashboard-no-categories">Your solution categories will appear here.</p>}
        </div>
      </section>

      <section className="dashboard-brand-card">
        <span><RotateCcw size={25}/></span>
        <strong>Save time. Solve faster.</strong>
        <small>The Last Time Machine</small>
      </section>
    </aside>
  </div>;
}

function TeamPage({workspace,session,notify}) {
  const [members,setMembers] = useState([]);
  const [loadingMembers,setLoadingMembers] = useState(true);
  const [memberError,setMemberError] = useState('');
  const [inviteEmail,setInviteEmail] = useState('');
  const [inviteNote,setInviteNote] = useState('');
  const [inviteUrl,setInviteUrl] = useState('');
  const [inviting,setInviting] = useState(false);
  const [savingPermissionsFor,setSavingPermissionsFor] = useState('');
  const [expandedPermissionsFor,setExpandedPermissionsFor] = useState(null);
  const isOwner = workspace?.owner_id === session?.user?.id;

  useEffect(() => {
    setExpandedPermissionsFor(null);
  },[workspace?.id]);

  useEffect(() => {
    let alive = true;
    async function loadMembers() {
      if (!supabase || !workspace?.id) { setLoadingMembers(false); return; }
      setLoadingMembers(true); setMemberError('');
      try {
        const {data: memberRows,error: memberQueryError} = await supabase.from('workspace_members')
          .select('user_id,role,joined_at').eq('workspace_id',workspace.id).order('joined_at',{ascending:true});
        if (memberQueryError) throw memberQueryError;
        const rows = memberRows || [];
        const ids = rows.map(member => member.user_id);
        let profileRows = [];
        let permissionRows = [];
        if (ids.length) {
          const {data: fetchedProfiles,error: profileError} = await supabase.from('profiles')
            .select('user_id,display_name,email,username,bio,avatar_path').in('user_id',ids);
          if (profileError) throw profileError;
          profileRows = await Promise.all((fetchedProfiles || []).map(async memberProfile => {
            let avatarUrl = null;
            if (memberProfile.avatar_path) {
              const {data: signed,error: signedError} = await supabase.storage.from('profile-avatars').createSignedUrl(memberProfile.avatar_path, 3600);
              if (!signedError) avatarUrl = signed?.signedUrl || null;
            }
            return {...memberProfile,avatarUrl};
          }));
          const {data: fetchedPermissions,error: permissionsError} = await supabase.from('workspace_member_permissions')
            .select('user_id,can_create_solutions,can_edit_solutions,can_delete_solutions').eq('workspace_id',workspace.id);
          if (permissionsError) throw permissionsError;
          permissionRows = fetchedPermissions || [];
        }
        const profilesById = Object.fromEntries(profileRows.map(profile => [profile.user_id, profile]));
        const permissionsById = Object.fromEntries(permissionRows.map(permission => [permission.user_id, permission]));
        const enriched = rows.map(member => ({
          ...member,
          profile: profilesById[member.user_id] || null,
          permissions: permissionsById[member.user_id] || {can_create_solutions:false,can_edit_solutions:false,can_delete_solutions:false}
        }));
        if (alive) setMembers(enriched);
      } catch(e) { if (alive) setMemberError(e.message || 'Could not load workspace members.'); }
      finally { if (alive) setLoadingMembers(false); }
    }
    loadMembers(); return () => { alive = false; };
  },[workspace?.id,session?.user?.id]);

  function changePermission(userId,key,value) {
    setMembers(current => current.map(member => member.user_id===userId
      ? {...member,permissions:{...(member.permissions||{}),[key]:value}}
      : member));
  }

  async function saveMemberPermissions(member) {
    if (!isOwner || !member || member.user_id===session?.user?.id) return;
    setSavingPermissionsFor(member.user_id);
    try {
      const row = member.permissions || {};
      const {error} = await supabase.from('workspace_member_permissions').upsert({
        workspace_id:workspace.id,
        user_id:member.user_id,
        can_create_solutions:!!row.can_create_solutions,
        can_edit_solutions:!!row.can_edit_solutions,
        can_delete_solutions:!!row.can_delete_solutions,
        updated_at:new Date().toISOString()
      }, {onConflict:'workspace_id,user_id'});
      if (error) throw error;
      notify('Member permissions saved.');
      setExpandedPermissionsFor(null);
    } catch(e) {
      notify(e.message || 'Could not save member permissions.');
    } finally { setSavingPermissionsFor(''); }
  }

  async function createInvite(e) {
    e.preventDefault(); setInviteNote(''); setInviteUrl('');
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setInviteNote('Enter a valid email address.'); return; }
    if (!supabase || !workspace?.id) { setInviteNote('App or workspace is not configured.'); return; }
    setInviting(true);
    try {
      const {data,error} = await supabase.functions.invoke('workspace-invitations', {body:{action:'create',workspaceId:workspace.id,email}});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.inviteUrl) throw new Error('The invitation service did not return a link.');
      setInviteUrl(data.inviteUrl);
      const subject = encodeURIComponent(`Invitation to ${workspace.name || 'The Last Time Machine'}`);
      const body = encodeURIComponent(`Hi,\n\nYou have been invited to join \"${workspace.name || 'The Last Time Machine'}\". Open this one-time invitation link within 7 days, then sign in or create an account using this exact email address: ${email}\n\n${data.inviteUrl}\n\nIf you were not expecting this invitation, you can ignore this email.`);
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
      setInviteNote(`Secure invite created for ${email}. It expires ${new Date(data.expiresAt).toLocaleString()}. Send the link in the email draft; access is granted only after the invitee signs in and accepts it.`);
      setInviteEmail('');
    } catch(e) { setInviteNote(e.message || 'Could not create invitation. Deploy the invitation function and apply its migration first.'); }
    finally { setInviting(false); }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> TEAM WORKSPACE</div><h1>Your team</h1><p className="page-subtitle">See who belongs to this workspace and invite teammates securely.</p></div></div>
    <div className="team-layout">
      <section className="team-panel">
        <div className="eyebrow">WORKSPACE MEMBERS</div><h2>{workspace?.name || 'Your workspace'}</h2>
        <p className="panel-copy">New teammates start with view-only access. As owner, grant only the solution permissions each person needs.</p>
        {loadingMembers ? <div className="member-empty"><div className="loader"/> Loading members…</div> : memberError ? <div className="form-error">{memberError}</div> : members.length ? members.map(member => {
          const profileEmail = member.profile?.email || (member.user_id===session?.user?.id ? session?.user?.email : '');
          const profileName = member.profile?.display_name && member.profile.display_name !== 'Workspace member'
            ? member.profile.display_name
            : (profileEmail ? profileEmail.split('@')[0].replace(/[._-]+/g,' ') : 'Workspace member');
          const isSelf = member.user_id===session?.user?.id;
          const mayManage = isOwner && !isSelf;
          const permissions = member.permissions || {can_create_solutions:false,can_edit_solutions:false,can_delete_solutions:false};
          return <div className="member-access-card" key={member.user_id}>
            <div className="member-row">
              <div className="profile-avatar">{member.profile?.avatarUrl?<img src={member.profile.avatarUrl} alt=""/>:(profileName || profileEmail || 'M').slice(0,1).toUpperCase()}</div>
              <div className="member-identity">
                {mayManage
                  ? <button
                      type="button"
                      className={`member-name-button ${expandedPermissionsFor===member.user_id?'expanded':''}`}
                      aria-expanded={expandedPermissionsFor===member.user_id}
                      aria-controls={`member-permissions-${member.user_id}`}
                      onClick={()=>setExpandedPermissionsFor(current=>current===member.user_id?null:member.user_id)}
                    >
                      <span>{profileName || 'Workspace member'}{isSelf ? ' (you)' : ''}</span>
                      <ChevronDown size={15}/>
                    </button>
                  : <strong>{profileName || 'Workspace member'}{isSelf ? ' (you)' : ''}</strong>}
                {member.profile?.username&&<p className="member-profile-handle">{mayManage
                  ? <button type="button" className="member-handle-button" onClick={()=>setExpandedPermissionsFor(current=>current===member.user_id?null:member.user_id)} aria-expanded={expandedPermissionsFor===member.user_id}>@{member.profile.username}</button>
                  : <span>@{member.profile.username}</span>}</p>}
                {profileEmail&&<p>{profileEmail}</p>}
                {member.profile?.bio&&<p className="member-profile-bio">{member.profile.bio}</p>}
                <p>{member.role || 'member'}{member.joined_at ? ' · joined ' + new Date(member.joined_at).toLocaleDateString() : ''}</p>
              </div>
              {member.role==='owner'&&<span className="detail-category">Owner</span>}
            </div>
            {mayManage && expandedPermissionsFor===member.user_id ? <div className="member-permissions-dropdown" id={`member-permissions-${member.user_id}`}>
              <div className="member-permissions">
                <div className="permission-panel-heading"><ShieldCheck size={16}/> Solution permissions</div>
                <label className="permission-option"><input type="checkbox" checked={!!permissions.can_create_solutions} onChange={e=>changePermission(member.user_id,'can_create_solutions',e.target.checked)}/> Create solutions</label>
                <label className="permission-option"><input type="checkbox" checked={!!permissions.can_edit_solutions} onChange={e=>changePermission(member.user_id,'can_edit_solutions',e.target.checked)}/> Edit solutions</label>
                <label className="permission-option"><input type="checkbox" checked={!!permissions.can_delete_solutions} onChange={e=>changePermission(member.user_id,'can_delete_solutions',e.target.checked)}/> Delete solutions</label>
                <button type="button" className="secondary-btn permission-save" disabled={savingPermissionsFor===member.user_id} onClick={()=>saveMemberPermissions(member)}>{savingPermissionsFor===member.user_id?'Saving…':'Save permissions'}</button>
              </div>
            </div> : !mayManage ? <div className="member-access-note">{isSelf && isOwner ? 'Owner · full access' : 'Access: ' + (permissions.can_create_solutions || permissions.can_edit_solutions || permissions.can_delete_solutions ? [permissions.can_create_solutions?'create':'',permissions.can_edit_solutions?'edit':'',permissions.can_delete_solutions?'delete':''].filter(Boolean).join(', ') : 'view and search only')}</div> : null}
          </div>;
        }) : <div className="member-empty">No membership records found. Refresh or check your workspace permissions.</div>}
      </section>
      {isOwner ? <section className="team-panel"><div className="eyebrow">INVITE A TEAMMATE</div><h2>Bring your team in</h2><p className="panel-copy">Create a single-use invitation link that expires in seven days. Email delivery is opened in your mail app; the server never trusts the browser to grant membership.</p>
        <form className="solution-form" onSubmit={createInvite}><label>Teammate email<input type="email" required value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="teammate@company.com"/></label><button className="secondary-btn" disabled={inviting}><Mail size={16}/>{inviting?'Creating secure invitation…':'Create secure invitation'}</button>{inviteNote&&<div className={inviteUrl?'form-success':'form-error'} role="status">{inviteNote}</div>}{inviteUrl&&<><label>Invitation link<input readOnly value={inviteUrl} onFocus={e=>e.target.select()}/></label><button type="button" className="secondary-btn" onClick={async()=>{try{await navigator.clipboard.writeText(inviteUrl);notify('Invitation link copied');}catch{notify('Select and copy the invitation link above.');}}}>Copy invitation link</button></>}</form>
        <div className="coming-list"><div><ShieldCheck size={16}/> Invitees start with view-only access. Grant more privileges from the member list after they join.</div></div>
      </section> : <section className="team-panel"><div className="eyebrow">TEAM ACCESS</div><h2>Managed by your owner</h2><p className="panel-copy">Your workspace owner manages invitations and your access to creating, editing, and deleting solutions.</p></section>}
    </div>
  </>;
}

function PlansPage({notify}) {
  const [billingCycle,setBillingCycle] = useState('monthly');
  const plans = [
    {key:'starter',name:'Starter',monthly:0,annual:0,description:'Free preview with a small knowledge-base allowance',features:['Multiple workspaces during preview','Up to 10 saved solutions per workspace','Search and organise solutions','CSV export'],current:true},
    {key:'team',name:'Team',monthly:20,annual:200,description:'For teams that need a reliable shared knowledge base',features:['Up to 500 saved solutions per workspace','Team invitations and access permissions','Searchable solutions and reference images','CSV export and workspace settings'],current:false},
    {key:'business',name:'Business',monthly:39,annual:390,description:'For teams documenting more of their operations',features:['Everything in Team','2,500 saved solutions included','Additional solutions: $0.05 per solution per month','No hard cap on solution count'],current:false}
  ];
  const money = (amount) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
  function openCheckout(plan) {
    if (plan.current) { notify('Starter is the default free preview.'); return; }
    notify(`${plan.name} is coming soon. Paid subscriptions are not available yet.`);
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SIMPLE PRICING</div><h1>Plans for your knowledge base</h1><p className="page-subtitle">Choose a plan for the way your team captures and reuses fixes.</p></div><div className="billing-toggle"><button className={billingCycle==='monthly'?'active':''} onClick={()=>setBillingCycle('monthly')}>Monthly</button><button className={billingCycle==='annual'?'active':''} onClick={()=>setBillingCycle('annual')}>Annual <span>Save 2 months</span></button></div></div>
    <div className="pricing-grid">{plans.map((plan,i)=>{const amount=billingCycle==='monthly'?plan.monthly:plan.annual;return <section className={`pricing-card ${i===1?'pricing-featured':''}`} key={plan.key}>{i===1&&<span className="pricing-badge">RECOMMENDED</span>}<h2>{plan.name}</h2><p>{plan.description}</p><div className="pricing-price"><strong>{amount===0?'Free':money(amount)}</strong>{plan.key!=='starter'&&<span> USD / {billingCycle==='monthly'?'month':'year'}</span>}</div><ul>{plan.features.map(f=><li key={f}><Check size={16}/>{f}</li>)}</ul><button className={plan.current?'secondary-btn':'primary-btn'} aria-label={plan.current?'Starter free preview':`${plan.name} plan coming soon`} onClick={()=>openCheckout(plan)}><ArrowRight size={16}/>{plan.current?'Default preview':'Coming soon'}</button></section>;})}</div>
    <p className="billing-disclaimer"><LockKeyhole size={15}/> Paid plans are coming soon. You can continue using the free Starter preview. No payment will be taken until subscriptions are available.</p>
  </>;
}

function ProfilePage({profile,email,loading,loadError,saving,onSave}) {
  const [displayName,setDisplayName] = useState(profile?.display_name || '');
  const [username,setUsername] = useState(profile?.username || '');
  const [bio,setBio] = useState(profile?.bio || '');
  const [avatarFile,setAvatarFile] = useState(null);
  const [avatarPreview,setAvatarPreview] = useState(null);
  const [removeAvatar,setRemoveAvatar] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');

  useEffect(() => {
    setDisplayName(profile?.display_name || '');
    setUsername(profile?.username || '');
    setBio(profile?.bio || '');
    setAvatarFile(null);
    setAvatarPreview(null);
    setRemoveAvatar(false);
  },[profile?.user_id,profile?.display_name,profile?.username,profile?.bio,profile?.avatar_path]);

  useEffect(() => () => {
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
  },[avatarPreview]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await onSave({displayName,username,bio,avatarFile,removeAvatar});
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
      setMessage('Your profile has been saved.');
    } catch (e) {
      setError(e.message || 'Could not save your profile.');
    }
  }

  const visibleAvatar = avatarPreview || (!removeAvatar ? profile?.avatarUrl : null);
  return <>
    <div className="page-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR ACCOUNT</div><h1>Your profile</h1><p className="page-subtitle">Choose how you appear to teammates across your workspaces.</p></div>
    </div>
    {loading&&<div className="member-access-note">Loading your saved profile…</div>}
    {loadError&&<div className="form-error" role="status" style={{marginBottom:16}}>Your saved profile could not be fully loaded: {loadError}</div>}
    <div className="profile-page-grid">
      <section className="profile-editor-panel">
        <div className="profile-editor-heading"><div><div className="eyebrow">PROFILE DETAILS</div><h2>Make it yours</h2><p>Your profile details are attached to your account, not just this workspace.</p></div></div>
        <form className="profile-form" onSubmit={submit}>
          <div className="profile-picture-row">
            <div className="profile-picture-preview">{visibleAvatar?<img src={visibleAvatar} alt="Profile picture preview"/>:<UserRound size={34}/>}</div>
            <div className="profile-picture-controls">
              <strong>Profile picture</strong>
              <p>JPG, PNG, WebP, or GIF · up to 5 MB</p>
              <div className="profile-picture-actions">
                <label className="secondary-btn profile-upload-btn"><Camera size={15}/> Choose photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){setError('Profile pictures must be 5 MB or smaller.');e.target.value='';return;}setAvatarFile(file);setAvatarPreview(URL.createObjectURL(file));setRemoveAvatar(false);setError('');}}/></label>
                {(profile?.avatar_path||avatarFile)&&<button type="button" className="secondary-btn profile-remove-btn" onClick={()=>{setAvatarFile(null);setAvatarPreview(null);setRemoveAvatar(true);setError('');}}>Remove photo</button>}
              </div>
            </div>
          </div>
          <label>Display name <span>Shown beside your profile picture</span><input autoComplete="name" maxLength={80} value={displayName} onChange={e=>setDisplayName(e.target.value)} required placeholder="Your name"/></label>
          <label>Username <span>Optional · unique handle for your account</span><div className="profile-username-field"><AtSign size={16}/><input autoComplete="username" maxLength={24} value={username} onChange={e=>setUsername(e.target.value.replace(/^@/,''))} placeholder="yourname"/></div><small>3–24 characters: letters, numbers, dots, underscores, and hyphens.</small></label>
          <label>Bio <span>Optional · shown on your profile</span><textarea maxLength={160} rows={3} value={bio} onChange={e=>setBio(e.target.value)} placeholder="A little about you or what you do…"/></label>
          <div className="profile-form-bottom"><span>{bio.length}/160 characters</span><button className="primary-btn" type="submit" disabled={saving||loading}><Save size={16}/>{saving?'Saving profile…':'Save profile'}</button></div>
          {error&&<div className="form-error" role="alert">{error}</div>}
          {message&&<div className="form-success" role="status">{message}</div>}
        </form>
      </section>
      <aside className="profile-preview-panel">
        <div className="eyebrow">PROFILE PREVIEW</div>
        <div className="profile-preview-card">
          <div className="profile-preview-cover"><div className="profile-preview-orbit"/></div>
          <div className="profile-preview-avatar">{visibleAvatar?<img src={visibleAvatar} alt=""/>:<UserRound size={32}/>}</div>
          <div className="profile-preview-copy"><h2>{displayName.trim()||'Your name'}</h2><span>{username.trim()?'@'+username.trim().replace(/^@/,'').toLowerCase():'Add a username'}</span><p>{bio.trim()||'Your bio will appear here.'}</p></div>
        </div>
        <div className="profile-account-note"><ShieldCheck size={17}/><span><strong>Account-wide profile</strong>Your name, username, bio, and picture appear to teammates in shared workspaces. Your email is used for sign-in and may be shown to workspace members for identification.</span></div>
        <div className="profile-account-email"><Mail size={16}/><div><span>Account email</span><strong>{email}</strong><small>Email changes are managed through authentication settings.</small></div></div>
      </aside>
    </div>
  </>;
}

function SettingsPage({workspace,activePlanKey,canRenameWorkspace,workspaceName,setWorkspaceName,onSave,saving,message,error,onExport,email,onSignOut,onDeleteAccount,deletingAccount,deleteAccountError,themeKey,onThemeChange,themeSaving,themeError,themeMessage,onToggleSolutionReview,solutionReviewSaving,solutionReviewError,onViewPlans}) {
  const themePresets = [
    {key:'dark',name:'Studio Light',description:'Clean white dashboard with crisp blue accents',swatches:['#f5f7fb','#ffffff','#557ce8']},
    {key:'midnight',name:'Midnight',description:'Deep navy with bright cyan accents',swatches:['#081321','#122640','#55c7ff']},
    {key:'forest',name:'Forest',description:'Dark evergreen with mint accents',swatches:['#0b1713','#172d24','#69d8a2']},
    {key:'plum',name:'Plum',description:'Dark violet with lavender accents',swatches:['#140f20','#29203c','#b6a0ff']},
    {key:'light',name:'Warm Light',description:'Soft cream surfaces with sage accents',swatches:['#f7f5ef','#fffdf8','#59694f']}
  ];
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> PREFERENCES</div><h1>Settings</h1><p className="page-subtitle">Manage your workspace, appearance, and account.</p></div></div>
    <div className="settings-page-grid" style={{display:'grid',gap:18,marginTop:24}}>
      <section className="team-placeholder appearance-panel" style={{textAlign:'left',alignItems:'stretch'}}>
        <div className="eyebrow">APPEARANCE</div><h2 style={{marginTop:10}}>Color scheme</h2><p>Choose the colours you prefer. This setting follows your account across your workspaces and devices.</p>
        <div className="theme-preset-grid" role="group" aria-label="Color scheme presets">
          {themePresets.map(preset=><button
            key={preset.key}
            type="button"
            className={`theme-preset ${themeKey===preset.key?'selected':''}`}
            onClick={()=>onThemeChange(preset.key)}
            disabled={themeSaving}
            aria-pressed={themeKey===preset.key}
          >
            <span className={`theme-preview theme-preview-${preset.key}`}>
              <span className="theme-preview-sidebar"></span>
              <span className="theme-preview-main"><i></i><i></i><i></i></span>
            </span>
            <span className="theme-preset-copy"><strong>{preset.name}</strong><small>{preset.description}</small></span>
            <span className="theme-swatch-row">{preset.swatches.map(color=><i key={color} style={{backgroundColor:color}}></i>)}</span>
            {themeKey===preset.key&&<span className="theme-preset-check"><Check size={15}/></span>}
          </button>)}
        </div>
        {themeSaving&&<p className="theme-status" role="status">Saving your preference…</p>}
        {!themeSaving&&themeMessage&&<p className="theme-status theme-status-success" role="status">{themeMessage}</p>}
        {themeError&&<div className="form-error" role="alert">{themeError}</div>}
      </section>
      <section className="team-placeholder" style={{textAlign:'left',alignItems:'stretch'}}>
        <div className="eyebrow">WORKSPACE</div><h2 style={{marginTop:10}}>Workspace details</h2><p>Give your knowledge base a name your team will recognise.</p>
        {canRenameWorkspace ? <form onSubmit={onSave} className="solution-form"><label>Workspace name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} maxLength={120} required placeholder="e.g. Acme Support Team"/></label>{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success">{message}</div>}<button className="primary-btn" disabled={saving}>{saving?'Saving…':<><Check size={16}/> Save workspace</>}</button></form> : <p className="page-subtitle" role="status">Only the workspace owner can change the workspace name. Ask the owner to update it in Settings.</p>}
      </section>
      <section className="team-placeholder solution-review-settings" style={{textAlign:'left',alignItems:'stretch'}}>
        <div className="eyebrow">QUALITY CONTROL</div><h2 style={{marginTop:10}}>Solution review</h2>
        {activePlanKey !== 'business' ? <>
          <p>Have important solutions checked before they become available to your whole team. Enable an approval queue with the Business plan.</p>
          <div className="review-plan-lock"><Crown size={18}/><span><strong>Business plan feature</strong><small>New and edited solutions can require owner or admin approval.</small></span></div>
          <button type="button" className="secondary-btn review-plans-button" onClick={onViewPlans}><Crown size={16}/> View plans</button>
        </> : canRenameWorkspace ? <>
          <p>When enabled, new and edited solutions wait for approval before they appear in the shared knowledge base. Workspace owners and admins can approve submissions or request changes.</p>
          <label className="review-toggle-control">
            <input type="checkbox" checked={!!workspace?.solution_review_enabled} onChange={e=>onToggleSolutionReview(e.target.checked)} disabled={solutionReviewSaving}/>
            <span className="review-toggle-switch" aria-hidden="true"></span>
            <span className="review-toggle-copy"><strong>{workspace?.solution_review_enabled ? 'Solution review is enabled' : 'Enable solution review'}</strong><small>{workspace?.solution_review_enabled ? 'New and edited solutions need approval.' : 'Approved solutions continue to publish immediately.'}</small></span>
          </label>
          {solutionReviewSaving&&<p className="theme-status" role="status">Updating solution review…</p>}
          {solutionReviewError&&<div className="form-error" role="alert">{solutionReviewError}</div>}
        </> : <>
          <p>Solution review is {workspace?.solution_review_enabled ? 'enabled' : 'available'} for this Business workspace. Only the workspace owner can change this setting.</p>
        </>}
      </section>
      <section className="team-placeholder" style={{textAlign:'left',alignItems:'stretch'}}>
        <div className="eyebrow">YOUR DATA</div><h2 style={{marginTop:10}}>Export your knowledge</h2><p>Download your saved solutions as a CSV file that opens in Excel or Google Sheets. Keep a backup or use it for reporting.</p><button className="secondary-btn" onClick={onExport}><FileText size={16}/> Export solutions (.csv)</button>
      </section>
      <section className="team-placeholder" style={{textAlign:'left',alignItems:'stretch'}}>
        <div className="eyebrow">ACCOUNT</div><h2 style={{marginTop:10}}>Signed in</h2><p>{email}</p><p>For your security, sign out when using a shared computer.</p><button className="secondary-btn" onClick={onSignOut}><LogOut size={16}/> Sign out</button>
      </section>
      <section className="team-placeholder account-danger-zone" style={{textAlign:'left',alignItems:'stretch',gridColumn:'1 / -1'}}>
        <div className="eyebrow">ACCOUNT CONTROL</div><h2 style={{marginTop:10}}>Delete your account</h2><p>This is permanent. Your account will be removed. Workspaces you own cannot be deleted while other people still belong to them; transfer ownership first. Content in shared workspaces may be retained for the workspace and reassigned to its owner.</p>{deleteAccountError&&<div className="form-error" role="alert">{deleteAccountError}</div>}<button className="danger-btn" onClick={onDeleteAccount} disabled={deletingAccount}><Trash2 size={16}/>{deletingAccount?'Deleting account…':'Permanently delete account'}</button>
      </section>
    </div>
  </>;
}

function LegalPage({page}) {
  const title = page==='terms'?'Terms of Service':page==='privacy'?'Privacy Policy':'Acceptable Use Policy';
  return <div className="legal-shell"><div className="legal-top"><a className="brand legal-brand" href="/"><span className="brand-mark"><BrandClock size={20}/></span><span className="brand-name">The Last <span>Time Machine</span></span></a><a className="secondary-btn" href="/">Back to sign in</a></div><article className="legal-document"><div className="eyebrow"><span className="eyebrow-dot"/> LEGAL INFORMATION</div><h1>{title}</h1><p className="legal-effective">Version effective 13 October 2026 · Last updated 13 October 2026</p>{page==='terms'?<><h2>1. About the service</h2><p>The Last Time Machine is a workspace-based service for recording, searching, and reusing solutions to recurring business problems. Features may change. During preview or beta use, the service may be interrupted and features may be incomplete.</p><h2>2. Eligibility and accounts</h2><p>You must be legally able to enter a binding agreement where you live and be authorized to act for any business workspace you create. Keep your sign-in credentials secure, provide accurate account information, and promptly report suspected unauthorized access. If you are not legally eligible to agree to these terms, do not create an account.</p><h2>3. Workspace owners and members</h2><p>Workspace owners and administrators manage access and are responsible for inviting appropriate members. Members may be able to see workspace content. Do not add people who should not access that information. You are responsible for ensuring you have the right to upload content and share it with your workspace.</p><h2>4. Acceptable use</h2><p>You may not use the service unlawfully, infringe another person's rights, upload malware, probe or access accounts or data without permission, interfere with the service, or attempt to bypass access controls. Do not store passwords, payment-card details, government identifiers, health records, or other highly sensitive information in solution records.</p><h2>5. Your content</h2><p>You retain the rights you have in content you submit. You give the service permission to host, process, display, and back up that content only as reasonably necessary to operate, secure, and support the service. You are responsible for the accuracy and lawfulness of your content and should keep independent copies of important records.</p><h2>6. Availability and changes</h2><p>We aim to keep the service useful and secure but do not guarantee uninterrupted availability, error-free operation, or that every record can always be recovered. We may change or discontinue features and will make reasonable efforts to communicate material changes where appropriate.</p><h2>7. Suspension and termination</h2><p>Access may be suspended or terminated for security reasons, serious misuse, legal requirements, or material violations of these terms. You may stop using the service and request account deletion through Settings, subject to workspace ownership and data-retention constraints described in the Privacy Policy.</p><h2>8. Inactivity, account deletion, and workspace protection</h2><p>An account with no recorded activity for eight months may be scheduled for deletion after advance notices at approximately 30 days, 15 days, and 7 days before the deletion date. Signing in and using the service resets the inactivity period. To protect business records, accounts that own a workspace with other members or a workspace with an active or past-due subscription will not be automatically deleted until ownership or billing is resolved. Eligible accounts may lose sole-member workspaces, solutions, and reference images they own. Solutions in shared workspaces are retained for remaining members, and authorship may be reassigned to the workspace owner. Keep independent exports of important records. Mandatory legal rights and legally required retention take precedence.</p><h2>9. Disclaimers and limitation of liability</h2><p>To the fullest extent permitted by law, the service is provided on an “as available” basis and without warranties that the law does not allow us to disclaim. Nothing in these terms excludes or limits liability, consumer rights, or remedies that cannot lawfully be excluded or limited. To the fullest extent permitted by law, the operator will not be liable for indirect, incidental, special, consequential, exemplary, or punitive losses, loss of profits, loss of business, or loss of data. The operator’s total aggregate liability arising out of or related to the service will not exceed the greater of (a) the amount you paid to use the service during the 12 months before the event giving rise to the claim or (b) US$50. This cap does not apply where prohibited by law or to liability that cannot lawfully be limited.</p><h2>10. Subscriptions and billing</h2><p>The service is currently offered without paid subscriptions through this version of the terms. If paid plans are introduced, we will show the applicable price, billing interval, and material conditions before you purchase. Unless stated otherwise at checkout, subscriptions will renew for the displayed billing interval until cancelled. You may cancel future renewals using the available account or billing controls; cancellation generally takes effect at the end of the current paid period. Prices may exclude taxes, which will be shown or applied where required. Any price change for an existing subscription will be communicated in advance and will apply no earlier than the next renewal, subject to applicable law. Refunds are handled under the terms shown at purchase and mandatory law; nothing here removes non-waivable refund rights.</p><h2>11. Governing law and disputes</h2><p>These terms are governed by the laws of Saint Lucia, without preventing any mandatory consumer-protection rules that apply in your country of residence. Subject to those mandatory rights, the courts of Saint Lucia will have jurisdiction over disputes arising from these terms or the service. Nothing in this section prevents a consumer from bringing a claim in a court where applicable law gives them that right.</p><h2>12. Operator and contact</h2><p>The Last Time Machine is operated by Dimitre Richelieu, business address Mourne Dou Don Road, Castries, Saint Lucia. For support, privacy questions, or legal notices, email <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. These contact details do not imply that a separately incorporated company exists.</p></>:page==='privacy'?<><h2>1. Information we process</h2><p>Depending on how you use the service, we process your email address and authentication identifiers; your profile display name, optional username and bio, private profile-picture file, and selected interface color scheme; workspace name and membership; solution titles, problem descriptions, categories, steps, outcomes, and uploaded reference images; the last recorded time your account actively used the app; and basic technical information needed to operate and protect the service. Do not submit sensitive information that the service is not designed to handle.</p><h2>2. Purposes</h2><p>We use information to create and secure accounts, provide workspaces and knowledge-base features, support search and export, administer invitations, prevent abuse, maintain service reliability, and respond to support requests.</p><h2>3. Workspace visibility</h2><p>Workspace content is intended to be available to authorized workspace members and service administrators when necessary for support or security. Workspace owners control invitations. Do not upload information unless you are permitted to share it with the workspace.</p><h2>4. Providers and international processing</h2><p>We use Supabase for authentication, database services, and private image storage. The Supabase project is configured in the US East (North Virginia) region. The application frontend is deployed separately from Supabase; the identity and processing location of that frontend host depend on the deployment configuration. Service providers may process information in other countries under their applicable terms and safeguards. We update this notice when our material providers or processing arrangements change.</p><h2>5. Cookies and local storage</h2><p>The current application does not intentionally use advertising cookies or third-party analytics. Supabase authentication may use browser storage to keep your session signed in. If analytics, advertising, or other non-essential tracking is added later, this policy and any required consent controls must be updated before enabling it.</p><h2>6. Retention and deletion</h2><p>We retain information while an account or workspace needs it to provide the service, subject to security, legal, backup, and dispute-resolution needs. After eight months without recorded activity, an eligible account may be deleted following reminder notices at approximately 30 days, 15 days, and 7 days before deletion; signing in and using the app resets the timer. Accounts that own a workspace with other members or a workspace with an active or past-due subscription are protected from automatic deletion until the issue is resolved. Sole-member workspaces belonging to eligible deleted accounts may be removed with their solutions and images. Shared workspace records are retained for remaining members and authorship may be reassigned to the workspace owner. Backups may persist temporarily until normal rotation. Any mandatory retention obligations take precedence.</p><h2>7. Security</h2><p>We use access controls and private storage policies intended to limit access to authorized workspaces. No internet service can promise absolute security. Users should keep credentials secure and avoid uploading secrets or highly sensitive personal data. We continually work to maintain appropriate security controls, but no controls can eliminate every risk or guarantee that unauthorized access will never occur.</p><h2>8. Your choices and rights</h2><p>Depending on the law that applies to you, you may have the right to request access to your personal information, receive a copy of it, correct inaccurate information, request deletion or restriction of processing, object to certain processing, withdraw consent where processing relies on consent, and complain to a data-protection regulator. You may also have rights to data portability or to challenge certain automated decisions where the law provides them. You can export solution records and initiate account deletion from Settings. For requests that cannot be completed in the app, email <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. We will verify your identity where reasonably necessary and respond within the deadline required by applicable law; where GDPR applies, this is generally within one month, subject to lawful extensions. Some information may be retained where legally permitted or required, including for security, dispute resolution, and other members’ continued use of shared workspaces. Do not email passwords or highly sensitive records.</p><h2>9. Children and eligibility</h2><p>The service is intended for business use, not for children. Do not use it if you are not legally eligible to enter the agreement or if your organization has not authorized your use.</p><h2>10. Operator and contact</h2><p>The Last Time Machine is operated by Dimitre Richelieu, business address Mourne Dou Don Road, Castries, Saint Lucia. Privacy contact: <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. We will update this notice when our providers, data practices, or legal obligations materially change.</p></>:<><h2>Use the service lawfully</h2><p>Use The Last Time Machine only for lawful business knowledge management and only with workspaces and content you are authorized to access.</p><h2>Prohibited conduct</h2><ul><li>Accessing another workspace, account, or record without permission.</li><li>Uploading malware, attempting to exploit the application, or disrupting service availability.</li><li>Uploading content that infringes intellectual property, privacy, confidentiality, or other rights.</li><li>Using the service for fraud, harassment, unlawful surveillance, or any illegal purpose.</li><li>Storing passwords, payment-card information, government IDs, health records, or other sensitive secrets in solution records.</li><li>Trying to evade authentication, invitation expiry, workspace access policies, or usage limits.</li></ul><h2>Reporting misuse</h2><p>Report suspected abuse or unauthorized access to <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. Access may be restricted to protect users or comply with law.</p></>}</article><footer className="legal-page-footer"><nav className="legal-footer" aria-label="Legal pages"><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a><a href="/acceptable-use">Acceptable Use</a></nav></footer></div>;
}

function Modal({kind,item,categories=[],onClose,onSave,onEdit,onDelete,onReview,saving,signedIn,error:saveError,canEdit=true,canDelete=true,canReview=false,reviewEnabled=false}) {
  const [title,setTitle]=useState(item?.title||'');
  const [problem,setProblem]=useState(item?.problem_description||'');
  const [category,setCategory]=useState(item?.category||'General');
  const [creatingCategory,setCreatingCategory]=useState(false);
  const [newCategory,setNewCategory]=useState('');
  const categoryKey = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const categoryMatch = categories.find(value => categoryKey(value) === categoryKey(category));
  const [steps,setSteps]=useState((item?.steps||[]).join('\n'));
  const [outcome,setOutcome]=useState(item?.outcome||'');
  const [imagePath,setImagePath]=useState(item?.image_path||null);
  const [imageFile,setImageFile]=useState(null);
  const [imagePreview,setImagePreview]=useState(item?.image_url||'');
  const [error,setError]=useState('');
  const isForm=kind==='new'||kind==='edit';
  function submit(e){e.preventDefault();setError('');if(!title.trim()){setError('Add a title for this problem.');return;}if(title.trim().length>200){setError('Title must be 200 characters or fewer.');return;}if(!steps.trim()){setError('Add at least one solution step.');return;}if(creatingCategory&&!newCategory.trim()){setError('Enter a category name or choose an existing category.');return;}const rawCategory = creatingCategory ? newCategory : (categoryMatch || category);const cleanCategory = String(rawCategory || 'General').trim().replace(/\s+/g, ' ').slice(0,60) || 'General';const canonicalCategory = categories.find(value => categoryKey(value) === categoryKey(cleanCategory)) || cleanCategory;onSave({id:item?.id,title:title.trim(),problem_description:problem.trim(),category:canonicalCategory,steps:steps.split('\n').map(s=>s.trim()).filter(Boolean),outcome:outcome.trim(),imagePath,imageFile,oldImagePath:item?.image_path||null});}
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${isForm?'modal-wide':''}`} role="dialog" aria-modal="true"><div className="modal-head"><div><span className="modal-kicker">{isForm?'CAPTURE KNOWLEDGE':'SOLUTION DETAILS'}</span><h2>{kind==='new'?'Record a new fix':kind==='edit'?'Edit solution':item?.title}</h2></div><button className="icon-btn" onClick={onClose}><X size={19}/></button></div>
    {isForm?<form className="solution-form" onSubmit={submit}><label>Problem title <em>Required</em><input autoFocus value={title} onChange={e=>setTitle(e.target.value)} maxLength={200} placeholder="e.g. Customer payment keeps failing" required/></label><div className="form-two"><label>Category <em>Choose an existing category or create one</em><select value={creatingCategory ? "__create__" : (categoryMatch || category)} onChange={e=>{if(e.target.value==="__create__"){setCreatingCategory(true);setNewCategory("");}else{setCreatingCategory(false);setCategory(e.target.value);}}} aria-label="Choose category">{categories.map(c=><option key={c} value={c}>{c}</option>)}{!categoryMatch&&category&&<option value={category}>{category}</option>}<option value="__create__">＋ Create new category…</option></select>{creatingCategory&&<div className="category-create-row"><input autoFocus value={newCategory} onChange={e=>setNewCategory(e.target.value)} maxLength={60} placeholder="New category name" aria-label="New category name"/><button type="button" className="secondary-btn" onClick={()=>{const clean=newCategory.trim().replace(/\s+/g," ");if(!clean){setError("Enter a category name first.");return;}const existing=categories.find(c=>categoryKey(c)===categoryKey(clean));setCategory(existing||clean);setCreatingCategory(false);setNewCategory("");setError("");}}>Use category</button></div>}</label><label>What happened?<textarea value={problem} onChange={e=>setProblem(e.target.value)} rows={3} placeholder="Describe the problem and any symptoms…"/></label></div><label>Steps that fixed it <em>Required · one step per line</em><textarea value={steps} onChange={e=>setSteps(e.target.value)} rows={5} placeholder={'1. Check the account status\n2. Verify the settings\n3. Retry and confirm'} required/></label><label>Final outcome<textarea value={outcome} onChange={e=>setOutcome(e.target.value)} rows={2} placeholder="How did you confirm the problem was solved?"/></label><div className="optional-image-field"><label htmlFor="solution-image">Reference image <em>Optional</em></label><p>Add a screenshot or photo to help explain the fix. Images are private to your workspace. JPG, PNG, WebP or GIF · max 5 MB.</p><input id="solution-image" type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>5*1024*1024){setError('Images must be 5 MB or smaller.');e.target.value='';return;}setImageFile(f);setImagePath(null);setImagePreview(URL.createObjectURL(f));setError('');}} />{imagePreview&&<div className="image-preview-wrap"><img className="image-preview" src={imagePreview} alt="Selected solution reference" /><button type="button" className="secondary-btn" onClick={()=>{setImageFile(null);setImagePath(null);setImagePreview('');const input=document.getElementById('solution-image');if(input)input.value='';}}>Remove image</button></div>}</div>{error&&<div className="form-error" role="alert">{error}</div>}{saveError&&<div className="form-error" role="alert">{saveError}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="primary-btn" disabled={saving}>{saving?'Saving…':<><Check size={17}/> Save solution</>}</button></div></form>:
    <div className="solution-detail"><div className="detail-meta"><span className="detail-category">{item?.category||'General'}</span>{reviewEnabled&&<span className={`solution-review-badge status-${item?.review_status||'approved'}`}>{item?.review_status==='pending'?'Pending review':item?.review_status==='changes_requested'?'Changes requested':'Approved'}</span>}<span><Clock3 size={14}/> Updated {new Date(item?.updated_at||item?.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span></div><h3>What happened</h3><p>{item?.problem_description||'No description recorded.'}</p>{item?.image_url&&<div className="detail-image-wrap"><h3>Reference image</h3><a href={item.image_url} target="_blank" rel="noreferrer"><img className="detail-image" src={item.image_url} alt={`Reference for ${item.title}`} /></a></div>}<h3>Steps to fix it</h3><ol className="detail-steps">{(item?.steps||[]).map((step,i)=><li key={i}><span>{i+1}</span><p>{step}</p></li>)}</ol><h3>Outcome</h3><p>{item?.outcome||'No outcome recorded.'}</p><div className="modal-actions detail-actions">{canDelete&&<button className="danger-btn" onClick={()=>onDelete(item)}><Trash2 size={16}/> Delete</button>}{canEdit&&<button className="primary-btn" onClick={onEdit}><Pencil size={16}/> Edit solution</button>}{reviewEnabled&&canReview&&item?.review_status!=='approved'&&<><button type="button" className="secondary-btn" onClick={()=>onReview(item,'changes_requested')} disabled={saving}><Pencil size={16}/> Request changes</button><button type="button" className="primary-btn" onClick={()=>onReview(item,'approved')} disabled={saving}><Check size={16}/> Approve &amp; publish</button></>}</div></div>}
    </div></div>;
}
function timeAgo(date) { if(!date)return 'recently'; const days=Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/86400000)); if(days===0)return 'today';if(days===1)return 'yesterday';if(days<7)return `${days} days ago`;if(days<30)return `${Math.floor(days/7)}w ago`;return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }

createRoot(document.getElementById('root')).render(<App/>);
