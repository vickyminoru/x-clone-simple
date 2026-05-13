const SUPABASE_URL = 'https://zihkzaqbqgantvcuymwi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppaGt6YXFicWdhbnR2Y3V5bXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTc3ODgsImV4cCI6MjA5NDI3Mzc4OH0.FpCY3Mjqg94wW9i0cbnm6czOxDqBjDJYxphPC9Q7cvQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentMode = 'login';

function showTab(mode) {
  currentMode = mode;
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('authBtn').textContent = mode === 'login' ? 'ログイン' : '登録する';
  clearError();
}

function clearError() {
  const el = document.getElementById('authError');
  el.textContent = '';
  el.classList.add('hidden');
}

function showError(msg) {
  const el = document.getElementById('authError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

document.getElementById('authForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearError();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('authBtn');
  btn.disabled = true;

  let result;
  if (currentMode === 'login') {
    result = await supabase.auth.signInWithPassword({ email, password });
  } else {
    result = await supabase.auth.signUp({ email, password });
  }

  btn.disabled = false;

  if (result.error) {
    showError(result.error.message);
    return;
  }

  if (currentMode === 'signup' && !result.data.session) {
    showError('確認メールを送りました。メールをご確認ください。');
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    showApp();
  } else {
    showAuth();
  }
});

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('headerEmail').textContent = currentUser.email;
  loadFeed();
}

function showAuth() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function logout() {
  await supabase.auth.signOut();
}

const postContent = document.getElementById('postContent');
const charCount = document.getElementById('charCount');

postContent.addEventListener('input', () => {
  const remaining = 280 - postContent.value.length;
  charCount.textContent = remaining;
  charCount.style.color = remaining < 20 ? '#f4212e' : '#536471';
});

async function submitPost() {
  const content = postContent.value.trim();
  if (!content || !currentUser) return;

  const btn = document.getElementById('postBtn');
  btn.disabled = true;

  const { error } = await supabase.from('posts').insert({
    user_id: currentUser.id,
    content
  });

  btn.disabled = false;

  if (error) {
    alert('投稿に失敗しました: ' + error.message);
    return;
  }

  postContent.value = '';
  charCount.textContent = '280';
  charCount.style.color = '';
  loadFeed();
}

async function loadFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<p class="loading-msg">読み込み中...</p>';

  const { data, error } = await supabase
    .from('posts_with_user')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    feed.innerHTML = '<p class="loading-msg">読み込みに失敗しました。</p>';
    return;
  }

  if (!data.length) {
    feed.innerHTML = '<p class="loading-msg">まだ投稿がありません。</p>';
    return;
  }

  feed.innerHTML = data.map(post => renderPost(post)).join('');
}

function renderPost(post) {
  const handle = post.email.split('@')[0];
  const date = new Date(post.created_at).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const isOwn = currentUser && post.user_id === currentUser.id;
  const deleteBtn = isOwn
    ? `<button class="btn-delete" onclick="deletePost('${post.id}')">削除</button>`
    : '';

  return `
    <article class="post">
      <div class="post-avatar">${handle[0].toUpperCase()}</div>
      <div class="post-body">
        <div class="post-header">
          <span class="post-handle">@${handle}</span>
          <span class="post-date">${date}</span>
          ${deleteBtn}
        </div>
        <p class="post-content">${escapeHtml(post.content)}</p>
      </div>
    </article>
  `;
}

async function deletePost(id) {
  if (!confirm('この投稿を削除しますか？')) return;
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) { alert('削除に失敗しました: ' + error.message); return; }
  loadFeed();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
