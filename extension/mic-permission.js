const btn = document.getElementById('btn-grant');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    status.textContent = 'Microphone access granted! You can close this tab.';
    status.className = 'status';
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
    setTimeout(() => window.close(), 1500);
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      status.textContent = 'Permission denied. Please allow microphone access when prompted.';
    } else {
      status.textContent = 'Error: ' + err.message;
    }
    status.className = 'status error';
  }
});
