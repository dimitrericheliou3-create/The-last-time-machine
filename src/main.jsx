import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  Search, Plus, Clock3, LayoutDashboard, BookOpen, Users, Settings, LogOut, ImagePlus,
  ArrowUpRight, ChevronDown, Command, Lightbulb, ShieldCheck, Zap, X, Check,
  CircleHelp, Filter, MoreHorizontal, Pencil, Trash2, Menu, ArrowRight,
  FileText, Activity, LockKeyhole, Mail, Eye, EyeOff, RotateCcw
} from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const TERMS_VERSION = '2026-10-13';
const PRIVACY_VERSION = '2026-10-13';
const FREE_SOLUTION_LIMIT = 10;
const TEAM_SOLUTION_LIMIT = 500;
const BUSINESS_INCLUDED_SOLUTIONS = 2500;
const BUSINESS_EXTRA_SOLUTION_MONTHLY_PRICE = 0.05;

const moneyForOverage = (amount) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);

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
  const [hasPaidPlan, setHasPaidPlan] = useState(false);
  const [activePlanKey, setActivePlanKey] = useState('starter');
  const [myWorkspacePermissions, setMyWorkspacePermissions] = useState({can_create_solutions:false, can_edit_solutions:false, can_delete_solutions:false});
  const [solutions, setSolutions] = useState(demoSolutions);
  const [loadingData, setLoadingData] = useState(false);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const [category, setCategory] = useState('__all__');
  const [sortOrder, setSortOrder] = useState('recent');
  const [activeNav, setActiveNav] = useState('Solutions');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
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
    const token = new URLSearchParams(window.location.search).get('invite');
    if (token) setInviteToken(token);
  }, [session]);

  useEffect(() => { if (session?.user && !inviteToken) loadWorkspace(session.user); else if (!session) { setWorkspace(null); setSolutions(demoSolutions); setMyWorkspacePermissions({can_create_solutions:false, can_edit_solutions:false, can_delete_solutions:false}); } }, [session, inviteToken]);

  async function acceptWorkspaceInvite() {
    if (!supabase || !session?.user || !inviteToken) return;
    setInviteActionLoading(true); setInviteActionError('');
    try {
      const { data, error } = await supabase.functions.invoke('workspace-invitations', { body: { action: 'accept', token: inviteToken } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.success || !data?.workspace?.id) throw new Error('The invitation response was incomplete. Please ask the owner to send a new invitation.');
      preferredWorkspaceIdRef.current = data.workspace.id;
      setWorkspace(data.workspace); setWorkspaceName(data.workspace.name || '');
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

  async function loadWorkspace(user) {
    if (!supabase) return;
    setLoadingData(true);
    try {
      let membershipQuery = supabase
        .from('workspace_members').select('workspace_id, role, workspaces(id,name,owner_id,created_at)')
        .eq('user_id', user.id).order('joined_at', {ascending:true});
      const preferredWorkspaceId = preferredWorkspaceIdRef.current;
      if (preferredWorkspaceId) membershipQuery = membershipQuery.eq('workspace_id', preferredWorkspaceId);
      else membershipQuery = membershipQuery.limit(1);
      let { data: memberships, error: memberError } = await membershipQuery;
      if (memberError) throw memberError;
      let current = memberships?.[0]?.workspaces;
      if (preferredWorkspaceId) preferredWorkspaceIdRef.current = null;
      if (!current) {
        const {data: created, error:createError} = await supabase.from('workspaces')
          .insert({name: `${user.email?.split('@')[0] || 'My'} workspace`, owner_id:user.id})
          .select().single();
        if (createError) throw createError;
        // The database trigger creates the owner's membership row. Do not insert it again here.
        current = created;
      }
      setWorkspace(current);
      setWorkspaceName(current.name || '');
      if (current.owner_id === user.id) {
        setMyWorkspacePermissions({can_create_solutions:true, can_edit_solutions:true, can_delete_solutions:true});
      } else {
        const {data: permissionRow, error: permissionError} = await supabase.from('workspace_member_permissions')
          .select('can_create_solutions,can_edit_solutions,can_delete_solutions')
          .eq('workspace_id', current.id).eq('user_id', user.id).maybeSingle();
        if (permissionError) throw permissionError;
        setMyWorkspacePermissions({
          can_create_solutions: !!permissionRow?.can_create_solutions,
          can_edit_solutions: !!permissionRow?.can_edit_solutions,
          can_delete_solutions: !!permissionRow?.can_delete_solutions
        });
      }
      const { data: subscriptionRow } = await supabase.from('workspace_subscriptions').select('plan_key,status').eq('workspace_id', current.id).maybeSingle();
      const activePlan = subscriptionRow?.status === 'active' ? subscriptionRow.plan_key : 'starter';
      setActivePlanKey(activePlan);
      setHasPaidPlan(['team','business'].includes(activePlan));
      const {data, error} = await supabase.from('solutions').select('*').eq('workspace_id', current.id).order('updated_at',{ascending:false});
      if (error) throw error;
      setSolutions(await attachImageUrls(data || []));
    } catch (e) {
      setAuthError(e.message || 'Could not load workspace.');
      setSolutions([]);
    } finally { setLoadingData(false); }
  }

  async function submitAuth(e) {
    e.preventDefault(); setAuthError(''); setAuthMessage('');
    if (!supabase) { setAuthError('App configuration is missing. Follow the README setup steps.'); return; }
    setSaving(true);
    try {
      if (authMode === 'signup') {
        if (!legalAccepted) throw new Error('Please accept the Terms of Service and Privacy Policy to create an account.');
        const {data,error} = await supabase.auth.signUp({email:authEmail.trim(),password:authPassword, options:{data:{legal_terms_version:TERMS_VERSION, legal_privacy_version:PRIVACY_VERSION, legal_accepted_at:new Date().toISOString()}}});
        if (error) throw error;
        if (!data.session) setAuthMessage('Check your email for a confirmation link, then come back and sign in.');
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
      setSettingsMessage('Workspace name updated.');
      notify('Workspace settings saved');
    } catch (e) { setSettingsError(e.message || 'Could not update workspace.'); }
    finally { setSaving(false); }
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
        notify('Solution updated');
      } else {
        const {data,error} = await supabase.from('solutions').insert({
          workspace_id:workspace.id, created_by:session.user.id, title:payload.title,
          problem_description:payload.problem_description, category:payload.category,
          steps:payload.steps, outcome:payload.outcome, image_path:imagePath
        }).select().single();
        if (error) throw error;
        const decorated = (await attachImageUrls([data]))[0];
        setSolutions(prev=>[decorated,...prev]);
        notify('Solution saved to your workspace');
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

  const canCreateSolution = !supabase || workspace?.owner_id===session?.user?.id || myWorkspacePermissions.can_create_solutions;
  const canEditSolution = !supabase || workspace?.owner_id===session?.user?.id || myWorkspacePermissions.can_edit_solutions;
  const canDeleteSolution = !supabase || workspace?.owner_id===session?.user?.id || myWorkspacePermissions.can_delete_solutions;
  const legalView = new URLSearchParams(window.location.search).get('legal');
  if (legalView === 'terms' || legalView === 'privacy' || legalView === 'acceptable-use') return <LegalPage page={legalView} />;
  if (authLoading) return <div className="loading-screen"><div className="brand-mark"><RotateCcw size={24}/></div><span>Warming up the time machine…</span></div>;
  if (recoveryMode && session) return <PasswordRecoveryScreen password={recoveryPassword} setPassword={setRecoveryPassword} confirm={recoveryPasswordConfirm} setConfirm={setRecoveryPasswordConfirm} submit={saveRecoveredPassword} message={authMessage} error={authError} saving={saving} />;
  if (!session) return <AuthScreen configured={!!supabase} onResetPassword={requestPasswordReset} mode={authMode} setMode={setAuthMode} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} showPassword={showPassword} setShowPassword={setShowPassword} submit={submitAuth} message={authMessage} error={authError} saving={saving} legalAccepted={legalAccepted} setLegalAccepted={setLegalAccepted} />;
  if (inviteToken) return <div className="loading-screen"><div className="auth-card" style={{maxWidth:480, width:'calc(100% - 32px)', padding:32}}><div className="auth-card-icon"><Users size={22}/></div><div className="auth-overline">WORKSPACE INVITATION</div><h2>Join a team workspace</h2><p>Accepting this invitation will add the signed-in, email-confirmed account to the invited workspace. Invitation links expire after seven days and can only be used by the invited email address.</p>{inviteActionError&&<div className="form-error" role="alert">{inviteActionError}</div>}<button className="primary-btn" style={{width:'100%',justifyContent:'center'}} onClick={acceptWorkspaceInvite} disabled={inviteActionLoading}>{inviteActionLoading?'Verifying invitation…':'Accept invitation'}</button><button className="secondary-btn" style={{width:'100%',justifyContent:'center',marginTop:10}} onClick={()=>{window.history.replaceState({},'',window.location.pathname);setInviteToken('');}} disabled={inviteActionLoading}>Not now</button></div></div>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
      <div className="brand"><div className="brand-mark"><RotateCcw size={20}/></div><div className="brand-name">The Last <span>Time Machine</span><small>REAL PROBLEMS. REAL FIXES.</small></div><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace-switch"><div className="workspace-avatar">{(workspace?.name||'W').slice(0,1).toUpperCase()}</div><div className="workspace-text"><strong>{workspace?.name || 'Your workspace'}</strong><span>Workspace</span></div><ChevronDown size={16}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="main-nav">
        {[['Dashboard',LayoutDashboard],['Solutions',BookOpen],['Team',Users],['Plans',Zap]].map(([label,Icon])=><button key={label} className={`nav-item ${activeNav===label?'active':''}`} onClick={()=>{setActiveNav(label);setMobileNav(false);}}><Icon size={18}/><span>{label}</span>{label==='Solutions'&&solutions.length>0&&<span className="nav-count">{solutions.length}</span>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><Lightbulb size={17}/></div><strong>Knowledge that sticks.</strong><p>Capture a fix today. Save your team time tomorrow.</p><button onClick={()=>{setSaveError('');setModal({kind:'new'});}}>Add your first fix <ArrowRight size={14}/></button></div>
        <button className={`nav-item ${activeNav==='Settings'?'active':''}`} onClick={()=>{setActiveNav('Settings');setWorkspaceName(workspace?.name||'');setSettingsMessage('');setSettingsError('');setMobileNav(false);}}><Settings size={18}/><span>Settings</span></button>
        <div className="profile-row"><div className="profile-avatar">{session.user.email?.slice(0,1).toUpperCase()}</div><div className="profile-info"><strong>{session.user.email?.split('@')[0]}</strong><span>{session.user.email}</span></div><button className="icon-btn" title="Sign out" onClick={signOut}><LogOut size={17}/></button></div>
      </div>
    </aside>
    {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu size={20}/></button><div className="crumb">Workspace <span>/</span> <strong>{activeNav}</strong></div><div className="top-actions"><div className="secure-pill"><ShieldCheck size={15}/> Private workspace</div><div className="top-avatar">{session.user.email?.slice(0,1).toUpperCase()}</div></div></header>
      <div className="page-content">
        {authError && <div className="form-error" role="alert" style={{marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}><span>{authError}</span><button type="button" className="icon-btn" aria-label="Dismiss error" onClick={()=>setAuthError('')}><X size={16}/></button></div>}
        {activeNav==='Dashboard' ? <Dashboard solutions={solutions} onNew={()=>setModal({kind:'new'})} onBrowse={()=>setActiveNav('Solutions')} onOpenSolution={s=>{setSelected(s);setModal({kind:'view'});}} onEditSolution={s=>{setSelected(s);setModal({kind:'edit'});}} onDeleteSolution={deleteSolution} canCreate={canCreateSolution} canEdit={canEditSolution} canDelete={canDeleteSolution}/> :
          activeNav==='Team' ? <TeamPage workspace={workspace} session={session} notify={notify} /> :
          activeNav==='Plans' ? <PlansPage notify={notify} workspace={workspace} session={session} /> :
          activeNav==='Settings' ? <SettingsPage workspace={workspace} canRenameWorkspace={workspace?.owner_id === session.user.id} workspaceName={workspaceName} setWorkspaceName={setWorkspaceName} onSave={saveWorkspaceName} saving={saving} message={settingsMessage} error={settingsError} onExport={exportSolutions} email={session.user.email} onSignOut={signOut} onDeleteAccount={deleteAccount} deletingAccount={deletingAccount} deleteAccountError={deleteAccountError} /> :
          <>
            <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR KNOWLEDGE BASE</div><h1>Solutions <span className="heading-count">{solutions.length}</span></h1><p className="page-subtitle">Every problem solved is a lesson worth keeping.</p><div className="solution-limit-note">{activePlanKey === 'team' ? `Team: ${Math.min(solutions.length, TEAM_SOLUTION_LIMIT)} / ${TEAM_SOLUTION_LIMIT} solutions` : activePlanKey === 'business' ? `Business: ${solutions.length.toLocaleString()} / ${BUSINESS_INCLUDED_SOLUTIONS.toLocaleString()} included solutions` : `Free preview: ${Math.min(solutions.length, FREE_SOLUTION_LIMIT)} / ${FREE_SOLUTION_LIMIT} solutions`}</div>{activePlanKey === 'business' && solutions.length > BUSINESS_INCLUDED_SOLUTIONS && <p className="page-subtitle">Estimated overage: {moneyForOverage((solutions.length - BUSINESS_INCLUDED_SOLUTIONS) * BUSINESS_EXTRA_SOLUTION_MONTHLY_PRICE)} / month for {solutions.length - BUSINESS_INCLUDED_SOLUTIONS} extra solution(s). Overage billing is not active in this preview.</p>}</div><button className="primary-btn" onClick={()=>{if((activePlanKey==='starter'&&solutions.length>=FREE_SOLUTION_LIMIT)||(activePlanKey==='team'&&solutions.length>=TEAM_SOLUTION_LIMIT)){setActiveNav('Plans');notify(activePlanKey==='team'?`Team plan limit reached: ${TEAM_SOLUTION_LIMIT} solutions per workspace.`:`Free preview limit reached: ${FREE_SOLUTION_LIMIT} solutions per workspace.`);return;}setSelected(null);setSaveError('');setModal({kind:'new'});}}><Plus size={18}/> New solution</button></div>
            <div className="welcome-banner"><div className="welcome-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="welcome-clock"><RotateCcw size={25}/></div></div><div className="welcome-copy"><span className="banner-kicker">THE POWER OF NOT STARTING OVER</span><h2>You've solved it before.<br/><span>Find the fix in seconds.</span></h2><p>Document the hard-won knowledge your team shouldn't have to rediscover.</p></div></div>
            <div className="stats-row"><Stat icon={BookOpen} label="Saved solutions" value={solutions.length} tint="blue"/><Stat icon={Activity} label="Categories" value={new Set(solutions.map(s=>s.category||'General')).size} tint="violet"/><Stat icon={Clock3} label="Recently updated" value={solutions.filter(s=>Date.now()-new Date(s.updated_at||s.created_at).getTime()<86400000*7).length} tint="green"/></div>
            <div className="list-heading"><div><h2>Your team's fixes</h2><p>Search the knowledge your team has already earned.</p></div><span className="results-note">{filtered.length} result{filtered.length===1?'':'s'}</span></div>
            <div className="filter-bar"><div className="search-field"><Search size={18}/><input ref={searchInputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search problems, keywords, or steps…" aria-label="Search solutions"/><kbd><Command size={11}/> K</kbd></div><div className="select-wrap" title="Filter by category" onClick={e=>{if(e.target.tagName!=='SELECT'){const el=e.currentTarget.querySelector('select');el?.focus();try{el?.showPicker?.();}catch{}}}}><Filter size={16}/><select aria-label="Filter by category" value={category} onChange={e=>setCategory(e.target.value)}><option value="__all__">All categories</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select><ChevronDown size={14}/></div><div className="select-wrap" title="Sort solutions" onClick={e=>{if(e.target.tagName!=='SELECT'){const el=e.currentTarget.querySelector('select');el?.focus();try{el?.showPicker?.();}catch{}}}}><Clock3 size={16}/><select aria-label="Sort solutions" value={sortOrder} onChange={e=>setSortOrder(e.target.value)}><option value="recent">Recently updated</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select><ChevronDown size={14}/></div></div>
            {loadingData ? <div className="empty-state"><div className="loader"/><h3>Loading your knowledge…</h3></div> :
              filtered.length===0 ? <div className="empty-state"><div className="empty-icon"><Search size={25}/></div><h3>{query?'No matching fixes':'Your knowledge base is ready'}</h3><p>{query?'Try another keyword or change the category filter.':'Save the first solution so your team never has to solve it twice.'}</p><button className="primary-btn" onClick={()=>{if((activePlanKey==='starter'&&solutions.length>=FREE_SOLUTION_LIMIT)||(activePlanKey==='team'&&solutions.length>=TEAM_SOLUTION_LIMIT)){setActiveNav('Plans');notify(activePlanKey==='team'?`Team plan limit reached: ${TEAM_SOLUTION_LIMIT} solutions per workspace.`:`Free preview limit reached: ${FREE_SOLUTION_LIMIT} solutions per workspace.`);return;}setSaveError('');setModal({kind:'new'});}}><Plus size={17}/> Add a solution</button></div> :
              <div className="solution-grid">{filtered.map((s,i)=><SolutionCard key={s.id} item={s} index={i} onOpen={()=>{setSelected(s);setModal({kind:'view'});}} onEdit={()=>{setSelected(s);setModal({kind:'edit'});}} onDelete={()=>deleteSolution(s)} canEdit={canEditSolution} canDelete={canDeleteSolution}/>)}</div>}
            {!supabase&&<div className="demo-notice"><CircleHelp size={16}/><div><strong>Preview mode</strong><span>These are sample fixes. Add your Supabase settings to enable real accounts and persistent saving.</span></div></div>}
          </>}
      </div>
      <footer className="footer"><span>© {new Date().getFullYear()} The Last Time Machine</span><span className="footer-legal"><a href="?legal=terms" target="_blank" rel="noreferrer">Terms</a><a href="?legal=privacy" target="_blank" rel="noreferrer">Privacy</a><a href="?legal=acceptable-use" target="_blank" rel="noreferrer">Acceptable Use</a><LockKeyhole size={13}/> Your knowledge. Your workspace.</span></footer>
    </main>
    {modal&&<Modal kind={modal.kind} item={selected} categories={categoryOptions} onClose={()=>{setModal(null);setSelected(null);setSaveError('');}} onSave={saveSolution} error={saveError} onEdit={()=>{setSaveError('');setModal({kind:'edit'});}} onDelete={deleteSolution} saving={saving} signedIn={!!session} canEdit={canEditSolution} canDelete={canDeleteSolution} />}
    {toast&&<div className="toast"><Check size={17}/>{toast}</div>}
  </div>;
}

function PasswordRecoveryScreen({password,setPassword,confirm,setConfirm,submit,message,error,saving}) {
  return <div className="auth-shell"><div className="auth-left"><div className="brand auth-brand"><div className="brand-mark"><RotateCcw size={20}/></div><div className="brand-name">The Last <span>Time Machine</span><small>REAL PROBLEMS. REAL FIXES.</small></div></div><div className="auth-hero"><div className="eyebrow"><span className="eyebrow-dot"/> ACCOUNT SECURITY</div><h1>Back in<br/><span>control.</span></h1><p>Choose a new password to secure your knowledge base account.</p></div></div><div className="auth-right"><div className="auth-card"><div className="auth-card-icon"><LockKeyhole size={21}/></div><div className="auth-overline">RESET PASSWORD</div><h2>Choose a new password</h2><p>Use at least 8 characters and avoid reusing a password from another site.</p><form className="auth-form" onSubmit={submit}><label>New password</label><div className="auth-input"><LockKeyhole size={17}/><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></div><label>Confirm new password</label><div className="auth-input"><LockKeyhole size={17}/><input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Enter it again"/></div>{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<button className="primary-btn auth-submit" disabled={saving}>{saving?'Updating…':'Update password'}<ArrowRight size={17}/></button></form><div className="auth-legal">If this link has expired, request another password-reset email.</div></div></div></div>;
}

function AuthScreen({configured,onResetPassword,mode,setMode,email,setEmail,password,setPassword,showPassword,setShowPassword,submit,message,error,saving,legalAccepted,setLegalAccepted}) {
  return <div className="auth-shell"><div className="auth-left"><div className="brand auth-brand"><div className="brand-mark"><RotateCcw size={20}/></div><div className="brand-name">The Last <span>Time Machine</span><small>REAL PROBLEMS. REAL FIXES.</small></div></div><div className="auth-hero"><div className="eyebrow"><span className="eyebrow-dot"/> BUSINESS KNOWLEDGE, CAPTURED</div><h1>Stop solving<br/>the <span>same problem</span><br/>twice.</h1><p>Keep your team's best fixes in one searchable place. When the problem comes back, the answer is already here.</p><div className="auth-benefits"><div><div className="benefit-icon"><Search size={18}/></div><span><strong>Find it fast</strong><small>Search real solutions, not old chat threads.</small></span></div><div><div className="benefit-icon"><Users size={18}/></div><span><strong>Share team knowledge</strong><small>Help every teammate learn from every fix.</small></span></div><div><div className="benefit-icon"><Zap size={18}/></div><span><strong>Get back to work</strong><small>Less guesswork. More getting it done.</small></span></div></div></div><div className="auth-footnote"><ShieldCheck size={15}/> Built for the knowledge your business can't afford to lose.</div></div><div className="auth-right"><div className="auth-card"><div className="auth-card-icon"><LockKeyhole size={21}/></div><div className="auth-overline">YOUR KNOWLEDGE BASE</div><h2>{mode==='login'?'Welcome back':'Create your account'}</h2><p>{mode==='login'?'Sign in to pick up where your team left off.':'Start building a searchable record of every fix.'}</p>
    {!configured&&<div className="config-warning"><CircleHelp size={17}/><span>Supabase settings are needed before sign-in can work. Follow the README setup guide.</span></div>}
    <form onSubmit={submit} className="auth-form"><label>Email address</label><div className="auth-input"><Mail size={17}/><input type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)}/></div><label>Password</label><div className="auth-input"><LockKeyhole size={17}/><input type={showPassword?'text':'password'} required minLength={mode==='signup'?8:1} autoComplete={mode==='login'?'current-password':'new-password'} placeholder={mode==='signup'?'At least 8 characters':'Your password'} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='signup'&&<label className="legal-consent"><input type="checkbox" checked={legalAccepted} onChange={e=>setLegalAccepted(e.target.checked)} required/><span>I agree to the <a href="?legal=terms" target="_blank" rel="noreferrer">Terms of Service</a> and acknowledge the <a href="?legal=privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>}{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}</div>}<button className="primary-btn auth-submit" disabled={saving||!configured}>{saving?'Please wait…':mode==='login'?'Sign in':'Create account'}<ArrowRight size={17}/></button></form><div className="auth-switch">{mode==='login'&&<button type="button" onClick={onResetPassword} disabled={saving}>Forgot password?</button>} {mode==='login'?'New to The Last Time Machine?':'Already have an account?'} <button onClick={()=>{setMode(mode==='login'?'signup':'login');}}>{mode==='login'?'Create account':'Sign in'}</button></div><div className="auth-legal"><a href="?legal=terms" target="_blank" rel="noreferrer">Terms of Service</a> · <a href="?legal=privacy" target="_blank" rel="noreferrer">Privacy Policy</a> · <a href="?legal=acceptable-use" target="_blank" rel="noreferrer">Acceptable Use</a><br/>By signing up, you agree to the terms and acknowledge the privacy notice.</div></div><div className="auth-bottom"><span>© {new Date().getFullYear()} The Last Time Machine</span><span>Privacy-first by design</span></div></div></div>;
}

function Stat({icon:Icon,label,value,tint}) { return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon size={19}/></div><div><span>{label}</span><strong>{value}</strong></div><div className="stat-spark"><Activity size={16}/></div></div>; }

function SolutionCard({item,index,onOpen,onEdit,onDelete,canEdit=true,canDelete=true}) {
  const colors=['blue','violet','green','amber'];
  const iconMap={Payments:'↗','Account Access':'◎',Inventory:'▦',Email:'✉'};
  return <article className="solution-card" style={{animationDelay:`${index*55}ms`}}><div className="solution-card-top"><div className={`category-icon ${colors[index%colors.length]}`}>{iconMap[item.category]||<FileText size={18}/>}</div><div className="card-actions">{canEdit&&<button className="icon-btn" onClick={onEdit} title="Edit solution" aria-label={`Edit ${item.title}`}><MoreHorizontal size={19}/></button>}{canDelete&&<button className="icon-btn delete-card-btn" onClick={onDelete} title="Delete solution" aria-label={`Delete ${item.title}`}><Trash2 size={17}/></button>}</div></div><div className="solution-category">{item.category||'General'}</div><button className="solution-title" onClick={onOpen}>{item.title}</button><p className="solution-description">{item.problem_description||'No problem description added yet.'}</p>{item.image_url&&<img className="solution-card-image" src={item.image_url} alt={`Reference for ${item.title}`} loading="lazy" />}<div className="solution-card-bottom"><div className="last-fixed"><Clock3 size={14}/><span>Updated {timeAgo(item.updated_at||item.created_at)}</span></div><button className="view-link" onClick={onOpen}>View fix <ArrowUpRight size={15}/></button></div></article>;
}

function Dashboard({solutions,onNew,onBrowse,onOpenSolution,onEditSolution,onDeleteSolution,canCreate=true,canEdit=true,canDelete=true}) {
  const recent=[...solutions].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at)).slice(0,3);
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> YOUR OVERVIEW</div><h1>Good to have you back.</h1><p className="page-subtitle">Here's what your team's knowledge base looks like today.</p></div>{canCreate&&<button className="primary-btn" onClick={onNew}><Plus size={18}/> New solution</button>}</div><div className="welcome-banner dashboard-banner"><div className="welcome-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="welcome-clock"><RotateCcw size={24}/></div></div><div className="welcome-copy"><span className="banner-kicker">EVERY FIX BUILDS KNOWLEDGE</span><h2>Work smarter, not <span>from scratch.</span></h2><p>Turn your team's experience into your business's unfair advantage.</p></div></div><div className="stats-row"><Stat icon={BookOpen} label="Saved solutions" value={solutions.length} tint="blue"/><Stat icon={Activity} label="Categories" value={new Set(solutions.map(s=>s.category||'General')).size} tint="violet"/><Stat icon={Clock3} label="Recent fixes" value={solutions.filter(s=>Date.now()-new Date(s.created_at).getTime()<86400000*7).length} tint="green"/></div><div className="list-heading"><div><h2>Recently updated</h2><p>Jump back into your team's latest fixes.</p></div><button className="view-link" onClick={onBrowse}>All solutions <ArrowRight size={15}/></button></div><div className="solution-grid">{recent.map((s,i)=><SolutionCard key={s.id} item={s} index={i} onOpen={() => onOpenSolution(s)} onEdit={() => onEditSolution(s)} onDelete={() => onDeleteSolution(s)} canEdit={canEdit} canDelete={canDelete}/>)}</div></>;
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
  const isOwner = workspace?.owner_id === session?.user?.id;

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
            .select('user_id,display_name,email').in('user_id',ids);
          if (profileError) throw profileError;
          profileRows = fetchedProfiles || [];
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
              <div className="profile-avatar">{(profileName || profileEmail || 'M').slice(0,1).toUpperCase()}</div>
              <div className="member-identity">
                <strong>{profileName || 'Workspace member'}{isSelf ? ' (you)' : ''}</strong>
                {profileEmail&&<p>{profileEmail}</p>}
                <p>{member.role || 'member'}{member.joined_at ? ' · joined ' + new Date(member.joined_at).toLocaleDateString() : ''}</p>
              </div>
              {member.role==='owner'&&<span className="detail-category">Owner</span>}
            </div>
            {mayManage ? <div className="member-permissions">
              <div className="permission-panel-heading"><ShieldCheck size={16}/> Solution permissions</div>
              <label className="permission-option"><input type="checkbox" checked={!!permissions.can_create_solutions} onChange={e=>changePermission(member.user_id,'can_create_solutions',e.target.checked)}/> Create solutions</label>
              <label className="permission-option"><input type="checkbox" checked={!!permissions.can_edit_solutions} onChange={e=>changePermission(member.user_id,'can_edit_solutions',e.target.checked)}/> Edit solutions</label>
              <label className="permission-option"><input type="checkbox" checked={!!permissions.can_delete_solutions} onChange={e=>changePermission(member.user_id,'can_delete_solutions',e.target.checked)}/> Delete solutions</label>
              <button type="button" className="secondary-btn permission-save" disabled={savingPermissionsFor===member.user_id} onClick={()=>saveMemberPermissions(member)}>{savingPermissionsFor===member.user_id?'Saving…':'Save permissions'}</button>
            </div> : <div className="member-access-note">{isSelf && isOwner ? 'Owner · full access' : 'Access: ' + (permissions.can_create_solutions || permissions.can_edit_solutions || permissions.can_delete_solutions ? [permissions.can_create_solutions?'create':'',permissions.can_edit_solutions?'edit':'',permissions.can_delete_solutions?'delete':''].filter(Boolean).join(', ') : 'view and search only')}</div>}
          </div>;
        }) : <div className="member-empty">No membership records found. Refresh or check your workspace permissions.</div>}
        <div className="form-success" style={{marginTop:16}}>Permissions are enforced by Supabase. Hiding a button is not the security boundary.</div>
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
  const [checkoutPlan,setCheckoutPlan] = useState(null);
  const [customerEmail,setCustomerEmail] = useState('');
  const [cardName,setCardName] = useState('');
  const [showCheckout,setShowCheckout] = useState(false);
  const plans = [
    {key:'starter',name:'Starter',monthly:0,annual:0,description:'Free preview with a small knowledge-base allowance',features:['One workspace','Up to 10 saved solutions','Search and organise solutions','CSV export'],current:true},
    {key:'team',name:'Team',monthly:20,annual:200,description:'For teams that need a reliable shared knowledge base',features:['Up to 500 saved solutions per workspace','Shared team workspace','Searchable solutions and reference images','CSV export and workspace settings'],current:false},
    {key:'business',name:'Business',monthly:39,annual:390,description:'For teams documenting more of their operations',features:['Everything in Team','2,500 saved solutions included','Additional solutions: $0.05 per solution per month','No hard cap on solution count'],current:false}
  ];
  const money = (amount) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(amount);
  function openCheckout(plan) {
    if (plan.current) { notify('Starter is the default preview only; live subscription status is not connected.'); return; }
    setCheckoutPlan(plan); setCustomerEmail(''); setCardName(''); setShowCheckout(true);
  }
  function submitMockCheckout(e) {
    e.preventDefault();
    notify('Checkout is a visual draft only — no payment was taken and no plan was changed.');
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> SIMPLE PRICING</div><h1>Plans for your knowledge base</h1><p className="page-subtitle">Choose a plan for the way your team captures and reuses fixes.</p></div><div className="billing-toggle"><button className={billingCycle==='monthly'?'active':''} onClick={()=>setBillingCycle('monthly')}>Monthly</button><button className={billingCycle==='annual'?'active':''} onClick={()=>setBillingCycle('annual')}>Annual <span>Save 2 months</span></button></div></div>
    <div className="pricing-grid">{plans.map((plan,i)=>{const amount=billingCycle==='monthly'?plan.monthly:plan.annual;return <section className={`pricing-card ${i===1?'pricing-featured':''}`} key={plan.key}>{i===1&&<span className="pricing-badge">RECOMMENDED</span>}<h2>{plan.name}</h2><p>{plan.description}</p><div className="pricing-price"><strong>{amount===0?'Free':money(amount)}</strong>{plan.key!=='starter'&&<span> USD / {billingCycle==='monthly'?'month':'year'}</span>}</div><ul>{plan.features.map(f=><li key={f}><Check size={16}/>{f}</li>)}</ul><button className={plan.current?'secondary-btn':'primary-btn'} onClick={()=>openCheckout(plan)}><ArrowRight size={16}/>{plan.current?'Default preview':'Choose '+plan.name}</button></section>;})}</div>
    <p className="billing-disclaimer"><LockKeyhole size={15}/> Payment processing and overage billing are intentionally disabled in this draft. The checkout screen is for design and flow testing only; it cannot charge a card, create a subscription, collect the $0.05 Business overage, or unlock a paid plan.</p>
    {showCheckout&&checkoutPlan&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowCheckout(false);}}><div className="modal checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title"><div className="modal-head"><div><span className="modal-kicker">SECURE CHECKOUT · PREVIEW</span><h2 id="checkout-title">Subscribe to {checkoutPlan.name}</h2></div><button className="icon-btn" onClick={()=>setShowCheckout(false)} aria-label="Close checkout"><X size={19}/></button></div><form className="solution-form checkout-form" onSubmit={submitMockCheckout}><div className="checkout-total"><div><span>Due today</span><strong>{money(billingCycle==='monthly'?checkoutPlan.monthly:checkoutPlan.annual)}</strong></div><span>{billingCycle==='monthly'?'Renews monthly':'Billed annually'}</span></div><label>Email address<input type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} placeholder="you@company.com" required/></label><label>Name on card<input value={cardName} onChange={e=>setCardName(e.target.value)} placeholder="Full name" required/></label><div className="mock-card-fields"><div className="mock-card-brand"><span>Card details</span><span>VISA · Mastercard</span></div><div className="mock-card-number"><span>•••• •••• •••• ••••</span><LockKeyhole size={16}/></div><div className="mock-card-bottom"><span>MM / YY</span><span>CVC</span></div><p>Card entry is a visual placeholder in this draft.</p></div><div className="checkout-preview-note"><ShieldCheck size={17}/><span><strong>Preview only</strong>No payment information is collected or sent. No charge will occur.</span></div><button className="primary-btn" type="submit"><LockKeyhole size={16}/> Preview checkout action</button><button className="secondary-btn" type="button" onClick={()=>setShowCheckout(false)}>Cancel</button></form></div></div>}
  </>;
}

function SettingsPage({workspace,canRenameWorkspace,workspaceName,setWorkspaceName,onSave,saving,message,error,onExport,email,onSignOut,onDeleteAccount,deletingAccount,deleteAccountError}) {
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot"/> PREFERENCES</div><h1>Settings</h1><p className="page-subtitle">Manage your workspace and take a copy of your knowledge.</p></div></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:18,marginTop:24}}>
      <section className="team-placeholder" style={{textAlign:'left',alignItems:'stretch'}}>
        <div className="eyebrow">WORKSPACE</div><h2 style={{marginTop:10}}>Workspace details</h2><p>Give your knowledge base a name your team will recognise.</p>
        {canRenameWorkspace ? <form onSubmit={onSave} className="solution-form"><label>Workspace name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} maxLength={120} required placeholder="e.g. Acme Support Team"/></label>{error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success">{message}</div>}<button className="primary-btn" disabled={saving}>{saving?'Saving…':<><Check size={16}/> Save workspace</>}</button></form> : <p className="page-subtitle" role="status">Only the workspace owner can change the workspace name. Ask the owner to update it in Settings.</p>}
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
  return <div className="legal-shell"><div className="legal-top"><a className="brand legal-brand" href="/"><span className="brand-mark"><RotateCcw size={20}/></span><span className="brand-name">The Last <span>Time Machine</span></span></a><a className="secondary-btn" href="/">Back to sign in</a></div><article className="legal-document"><div className="eyebrow"><span className="eyebrow-dot"/> LEGAL INFORMATION</div><h1>{title}</h1><p className="legal-effective">Version effective 13 October 2026 · Last updated 13 October 2026</p>{page==='terms'?<><h2>1. About the service</h2><p>The Last Time Machine is a workspace-based service for recording, searching, and reusing solutions to recurring business problems. Features may change. During preview or beta use, the service may be interrupted and features may be incomplete.</p><h2>2. Eligibility and accounts</h2><p>You must be legally able to enter a binding agreement where you live and be authorized to act for any business workspace you create. Keep your sign-in credentials secure, provide accurate account information, and promptly report suspected unauthorized access. If you are not legally eligible to agree to these terms, do not create an account.</p><h2>3. Workspace owners and members</h2><p>Workspace owners and administrators manage access and are responsible for inviting appropriate members. Members may be able to see workspace content. Do not add people who should not access that information. You are responsible for ensuring you have the right to upload content and share it with your workspace.</p><h2>4. Acceptable use</h2><p>You may not use the service unlawfully, infringe another person's rights, upload malware, probe or access accounts or data without permission, interfere with the service, or attempt to bypass access controls. Do not store passwords, payment-card details, government identifiers, health records, or other highly sensitive information in solution records.</p><h2>5. Your content</h2><p>You retain the rights you have in content you submit. You give the service permission to host, process, display, and back up that content only as reasonably necessary to operate, secure, and support the service. You are responsible for the accuracy and lawfulness of your content and should keep independent copies of important records.</p><h2>6. Availability and changes</h2><p>We aim to keep the service useful and secure but do not guarantee uninterrupted availability, error-free operation, or that every record can always be recovered. We may change or discontinue features and will make reasonable efforts to communicate material changes where appropriate.</p><h2>7. Suspension and termination</h2><p>Access may be suspended or terminated for security reasons, serious misuse, legal requirements, or material violations of these terms. You may stop using the service and request account deletion through Settings, subject to workspace ownership and data-retention constraints described in the Privacy Policy.</p><h2>8. Inactivity, account deletion, and workspace protection</h2><p>An account with no recorded activity for eight months may be scheduled for deletion after advance notices at approximately 30 days, 15 days, and 7 days before the deletion date. Signing in and using the service resets the inactivity period. To protect business records, accounts that own a workspace with other members or a workspace with an active or past-due subscription will not be automatically deleted until ownership or billing is resolved. Eligible accounts may lose sole-member workspaces, solutions, and reference images they own. Solutions in shared workspaces are retained for remaining members, and authorship may be reassigned to the workspace owner. Keep independent exports of important records. Mandatory legal rights and legally required retention take precedence.</p><h2>9. Disclaimers and limitation of liability</h2><p>To the fullest extent permitted by law, the service is provided on an “as available” basis and without warranties that the law does not allow us to disclaim. Nothing in these terms excludes or limits liability, consumer rights, or remedies that cannot lawfully be excluded or limited. To the fullest extent permitted by law, the operator will not be liable for indirect, incidental, special, consequential, exemplary, or punitive losses, loss of profits, loss of business, or loss of data. The operator’s total aggregate liability arising out of or related to the service will not exceed the greater of (a) the amount you paid to use the service during the 12 months before the event giving rise to the claim or (b) US$50. This cap does not apply where prohibited by law or to liability that cannot lawfully be limited.</p><h2>10. Subscriptions and billing</h2><p>The service is currently offered without paid subscriptions through this version of the terms. If paid plans are introduced, we will show the applicable price, billing interval, and material conditions before you purchase. Unless stated otherwise at checkout, subscriptions will renew for the displayed billing interval until cancelled. You may cancel future renewals using the available account or billing controls; cancellation generally takes effect at the end of the current paid period. Prices may exclude taxes, which will be shown or applied where required. Any price change for an existing subscription will be communicated in advance and will apply no earlier than the next renewal, subject to applicable law. Refunds are handled under the terms shown at purchase and mandatory law; nothing here removes non-waivable refund rights.</p><h2>11. Governing law and disputes</h2><p>These terms are governed by the laws of Saint Lucia, without preventing any mandatory consumer-protection rules that apply in your country of residence. Subject to those mandatory rights, the courts of Saint Lucia will have jurisdiction over disputes arising from these terms or the service. Nothing in this section prevents a consumer from bringing a claim in a court where applicable law gives them that right.</p><h2>12. Operator and contact</h2><p>The Last Time Machine is operated by Dimitre Richelieu, business address Mourne Dou Don Road, Castries, Saint Lucia. For support, privacy questions, or legal notices, email <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. These contact details do not imply that a separately incorporated company exists.</p></>:page==='privacy'?<><h2>1. Information we process</h2><p>Depending on how you use the service, we process your email address and authentication identifiers; workspace name and membership; solution titles, problem descriptions, categories, steps, outcomes, and uploaded reference images; the last recorded time your account actively used the app; and basic technical information needed to operate and protect the service. Do not submit sensitive information that the service is not designed to handle.</p><h2>2. Purposes</h2><p>We use information to create and secure accounts, provide workspaces and knowledge-base features, support search and export, administer invitations, prevent abuse, maintain service reliability, and respond to support requests.</p><h2>3. Workspace visibility</h2><p>Workspace content is intended to be available to authorized workspace members and service administrators when necessary for support or security. Workspace owners control invitations. Do not upload information unless you are permitted to share it with the workspace.</p><h2>4. Providers and international processing</h2><p>We use Supabase for authentication, database services, and private image storage. The Supabase project is configured in the US East (North Virginia) region. The application frontend is deployed separately from Supabase; the identity and processing location of that frontend host depend on the deployment configuration. Service providers may process information in other countries under their applicable terms and safeguards. We update this notice when our material providers or processing arrangements change.</p><h2>5. Cookies and local storage</h2><p>The current application does not intentionally use advertising cookies or third-party analytics. Supabase authentication may use browser storage to keep your session signed in. If analytics, advertising, or other non-essential tracking is added later, this policy and any required consent controls must be updated before enabling it.</p><h2>6. Retention and deletion</h2><p>We retain information while an account or workspace needs it to provide the service, subject to security, legal, backup, and dispute-resolution needs. After eight months without recorded activity, an eligible account may be deleted following reminder notices at approximately 30 days, 15 days, and 7 days before deletion; signing in and using the app resets the timer. Accounts that own a workspace with other members or a workspace with an active or past-due subscription are protected from automatic deletion until the issue is resolved. Sole-member workspaces belonging to eligible deleted accounts may be removed with their solutions and images. Shared workspace records are retained for remaining members and authorship may be reassigned to the workspace owner. Backups may persist temporarily until normal rotation. Any mandatory retention obligations take precedence.</p><h2>7. Security</h2><p>We use access controls and private storage policies intended to limit access to authorized workspaces. No internet service can promise absolute security. Users should keep credentials secure and avoid uploading secrets or highly sensitive personal data. We continually work to maintain appropriate security controls, but no controls can eliminate every risk or guarantee that unauthorized access will never occur.</p><h2>8. Your choices and rights</h2><p>Depending on the law that applies to you, you may have the right to request access to your personal information, receive a copy of it, correct inaccurate information, request deletion or restriction of processing, object to certain processing, withdraw consent where processing relies on consent, and complain to a data-protection regulator. You may also have rights to data portability or to challenge certain automated decisions where the law provides them. You can export solution records and initiate account deletion from Settings. For requests that cannot be completed in the app, email <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. We will verify your identity where reasonably necessary and respond within the deadline required by applicable law; where GDPR applies, this is generally within one month, subject to lawful extensions. Some information may be retained where legally permitted or required, including for security, dispute resolution, and other members’ continued use of shared workspaces. Do not email passwords or highly sensitive records.</p><h2>9. Children and eligibility</h2><p>The service is intended for business use, not for children. Do not use it if you are not legally eligible to enter the agreement or if your organization has not authorized your use.</p><h2>10. Operator and contact</h2><p>The Last Time Machine is operated by Dimitre Richelieu, business address Mourne Dou Don Road, Castries, Saint Lucia. Privacy contact: <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. We will update this notice when our providers, data practices, or legal obligations materially change.</p></>:<><h2>Use the service lawfully</h2><p>Use The Last Time Machine only for lawful business knowledge management and only with workspaces and content you are authorized to access.</p><h2>Prohibited conduct</h2><ul><li>Accessing another workspace, account, or record without permission.</li><li>Uploading malware, attempting to exploit the application, or disrupting service availability.</li><li>Uploading content that infringes intellectual property, privacy, confidentiality, or other rights.</li><li>Using the service for fraud, harassment, unlawful surveillance, or any illegal purpose.</li><li>Storing passwords, payment-card information, government IDs, health records, or other sensitive secrets in solution records.</li><li>Trying to evade authentication, invitation expiry, workspace access policies, or usage limits.</li></ul><h2>Reporting misuse</h2><p>Report suspected abuse or unauthorized access to <a href="mailto:richelieureserved@gmail.com">richelieureserved@gmail.com</a>. Access may be restricted to protect users or comply with law.</p></>}</article><footer className="legal-footer"><a href="?legal=terms">Terms of Service</a><a href="?legal=privacy">Privacy Policy</a><a href="?legal=acceptable-use">Acceptable Use</a></footer></div>;
}

function Modal({kind,item,categories=[],onClose,onSave,onEdit,onDelete,saving,signedIn,error:saveError,canEdit=true,canDelete=true}) {
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
    <div className="solution-detail"><div className="detail-meta"><span className="detail-category">{item?.category||'General'}</span><span><Clock3 size={14}/> Updated {new Date(item?.updated_at||item?.created_at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span></div><h3>What happened</h3><p>{item?.problem_description||'No description recorded.'}</p>{item?.image_url&&<div className="detail-image-wrap"><h3>Reference image</h3><a href={item.image_url} target="_blank" rel="noreferrer"><img className="detail-image" src={item.image_url} alt={`Reference for ${item.title}`} /></a></div>}<h3>Steps to fix it</h3><ol className="detail-steps">{(item?.steps||[]).map((step,i)=><li key={i}><span>{i+1}</span><p>{step}</p></li>)}</ol><h3>Outcome</h3><p>{item?.outcome||'No outcome recorded.'}</p><div className="modal-actions detail-actions">{canDelete&&<button className="danger-btn" onClick={()=>onDelete(item)}><Trash2 size={16}/> Delete</button>}{canEdit&&<button className="primary-btn" onClick={onEdit}><Pencil size={16}/> Edit solution</button>}</div></div>}
    </div></div>;
}
function timeAgo(date) { if(!date)return 'recently'; const days=Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/86400000)); if(days===0)return 'today';if(days===1)return 'yesterday';if(days<7)return `${days} days ago`;if(days<30)return `${Math.floor(days/7)}w ago`;return new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }

createRoot(document.getElementById('root')).render(<App/>);
