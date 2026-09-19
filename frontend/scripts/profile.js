const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
function localReturn(value){try{const url=new URL(value,location.origin);if(!value||url.origin!==location.origin||url.pathname==='/profile.html')return null;return url.pathname+url.search+url.hash}catch{return null}}
const next=localReturn(params.get('next'));
const explicitReturn=localReturn(params.get('returnTo'));
const referringPage=localReturn(document.referrer);
$('.back').href=explicitReturn||referringPage||'/';
$('.back').textContent='← بازگشت به صفحهٔ قبلی';
$('.back').onclick=event=>{if(!explicitReturn&&referringPage&&history.length>1){event.preventDefault();history.back()}};
async function api(path,options={}){const response=await fetch(path,{headers:{'content-type':'application/json',...(options.headers||{})},...options});const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'خطا');return data}
function tab(name){document.querySelectorAll('.auth-tab').forEach(x=>x.classList.toggle('active',x.dataset.auth===name));$('#loginForm').classList.toggle('hidden',name!=='login');$('#registerForm').classList.toggle('hidden',name!=='register');$('#authError').textContent=''}
function fillProfile(user){$('#userAvatar').textContent=user.avatar||user.name[0];$('#userName').textContent=user.name;$('#profileName').value=user.name;$('#profileAvatar').value=user.avatar||'';$('#userRole').textContent=user.role==='admin'?'مدیر سیستم':'کاربر Game Vault';$('#userUsername').textContent='@'+user.username}
async function state(){const data=await api('/api/me');$('#guestState').classList.toggle('hidden',!data.guest);$('#userState').classList.toggle('hidden',data.guest);if(!data.guest)fillProfile(data.user)}
document.querySelectorAll('.auth-tab').forEach(button=>button.onclick=()=>tab(button.dataset.auth));
$('#loginForm').onsubmit=async event=>{event.preventDefault();try{const logged=await api('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});await state();new BroadcastChannel('game-vault').postMessage('profile');if(logged.user?.role==='admin'&&next&&next.startsWith('/'))location.href=next}catch(error){$('#authError').textContent=error.message}};
$('#registerForm').onsubmit=async event=>{event.preventDefault();try{const registered=await api('/api/auth/register',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});await state();new BroadcastChannel('game-vault').postMessage('profile');if(next&&next.startsWith('/'))location.href=next;return registered}catch(error){$('#authError').textContent=error.message}};
$('#profileForm').onsubmit=async event=>{event.preventDefault();try{const data=await api('/api/profile',{method:'PUT',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});fillProfile(data.user);$('#profileMessage').textContent='پروفایل ذخیره شد';new BroadcastChannel('game-vault').postMessage('profile')}catch(error){$('#profileMessage').textContent=error.message}};
$('#logoutBtn').onclick=async()=>{await api('/api/auth/logout',{method:'POST'});await state();new BroadcastChannel('game-vault').postMessage('profile')};
state().catch(error=>$('#authError').textContent=error.message);
