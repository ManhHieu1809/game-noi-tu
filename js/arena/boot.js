import('./main.js').catch(error=>{
  const el=document.getElementById('loading');el.replaceChildren();
  const p=document.createElement('p');p.textContent='Không tải được game 3D. Kiểm tra WebGL và tải lại trang.';
  const a=document.createElement('a');a.href='index.html';a.textContent='← Quay về nối từ';el.append(p,a);console.error('Arena initialization failed',error);
});
