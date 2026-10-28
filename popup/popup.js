document.getElementById('helloBtn').addEventListener('click', () => {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = '안녕하세요! 크롬 확장 프로그램입니다.';
});
