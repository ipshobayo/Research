const LANGS = {
  'en-US':'English','es-ES':'Spanish','fr-FR':'French','de-DE':'German','it-IT':'Italian','pt-BR':'Portuguese',
  'zh-CN':'Chinese (Mandarin)','ja-JP':'Japanese','ko-KR':'Korean','ar-SA':'Arabic','hi-IN':'Hindi','ru-RU':'Russian',
  'tr-TR':'Turkish','nl-NL':'Dutch','pl-PL':'Polish','sv-SE':'Swedish','yo-NG':'Yoruba','sw-KE':'Swahili','id-ID':'Indonesian','vi-VN':'Vietnamese',
};
const $ = id => document.getElementById(id);
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

let segments = [];            // {id, t, speaker, text, translation}
let recognition, active = false, startTime = 0;
let mediaStream, recorder, chunks = [], audioMode = 'none';
let speaker = 1;

for (const sel of [$('from'), $('to')])
  for (const [code, name] of Object.entries(LANGS)) sel.add(new Option(name, code));
$('from').value = localStorage.from || 'en-US';
$('to').value = localStorage.to || 'es-ES';
$('from').onchange = $('to').onchange = () => { localStorage.from = $('from').value; localStorage.to = $('to').value; if (active) { recognition.lang = $('from').value; recognition.stop(); } };
$('swap').onclick = () => { const f = $('from').value; $('from').value = $('to').value; $('to').value = f; $('from').onchange(); };

if (!SR) { $('unsupported').hidden = false; $('start').disabled = true; }

const fmt = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const status = (t, rec) => { $('status').textContent = t; $('status').classList.toggle('rec', !!rec); };

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
const ask = dlg => new Promise(r => { dlg.onclose = () => r(dlg.returnValue); dlg.returnValue = ''; dlg.showModal(); });

async function start() {
  audioMode = await ask($('audioDialog')) || 'none';
  if (audioMode !== 'none') {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(mediaStream);
      chunks = [];
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      recorder.start(1000);
    } catch (e) { status('Mic recording unavailable — continuing with transcript only'); audioMode = 'none'; }
  }
  startTime = Date.now(); active = true;
  $('start').disabled = true; $('stop').disabled = false; $('saveAudio').disabled = audioMode !== 'live';
  listen();
}

function listen() {
  recognition = new SR();
  recognition.continuous = true; recognition.interimResults = true; recognition.lang = $('from').value;
  recognition.onstart = () => status('Listening…', true);
  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i], text = r[0].transcript.trim();
      if (r.isFinal) { if (text) addSegment(text); } else interim += text + ' ';
    }
    $('interim').textContent = interim;
  };
  recognition.onerror = e => { if (e.error === 'not-allowed') { status('Microphone permission denied'); stop(); } };
  recognition.onend = () => { $('interim').textContent = ''; if (active) setTimeout(() => active && listen(), 150); };
  recognition.start();
}

async function addSegment(text) {
  const seg = { id: segments.length, t: Date.now() - startTime, speaker: $('swapSpeaker').checked ? speaker : 0, text, translation: '…', from: $('from').value, to: $('to').value };
  segments.push(seg); render();
  try {
    const r = await fetch('/api/translate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, from: seg.from, to: seg.to }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error);
    seg.translation = j.translation;
    if ($('speak').checked) say(seg.translation, seg.to);
  } catch (e) { seg.translation = '⚠ translation failed: ' + e.message; }
  render();
}

function say(text, lang) { const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.speak(u); }

function render() {
  $('empty').hidden = segments.length > 0;
  const log = $('log'); log.textContent = '';
  for (const s of segments) {
    const li = document.createElement('li');
    const meta = document.createElement('div'); meta.className = 'meta';
    meta.append(fmt(s.t));
    if (s.speaker) {
      const b = document.createElement('button'); b.className = 'spk s' + s.speaker; b.textContent = 'Speaker ' + s.speaker;
      b.onclick = () => { s.speaker = s.speaker === 1 ? 2 : 1; speaker = s.speaker === 1 ? 2 : 1; render(); };
      meta.append(b);
    }
    const src = document.createElement('div'); src.className = 'src'; src.textContent = s.text;
    const tr = document.createElement('div'); tr.className = 'tr'; tr.textContent = s.translation;
    li.append(meta, src, tr); log.append(li);
  }
  window.scrollTo(0, document.body.scrollHeight);
}

function currentAudio() { return new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }); }
const ext = () => (recorder?.mimeType || '').includes('mp4') ? 'm4a' : 'webm';

$('saveAudio').onclick = () => { if (chunks.length) download(`conversation-${fmt(Date.now() - startTime).replace(':', 'm')}s.${ext()}`, currentAudio()); };

async function stop() {
  active = false; recognition?.stop();
  $('start').disabled = false; $('stop').disabled = true; $('saveAudio').disabled = true; status('Stopped');
  if (recorder && recorder.state !== 'inactive') {
    await new Promise(r => { recorder.onstop = r; recorder.stop(); });
    mediaStream.getTracks().forEach(t => t.stop());
    if (audioMode !== 'none' && chunks.length) {
      $('endInfo').textContent = `Recorded ${fmt(Date.now() - startTime)} of audio (${(currentAudio().size / 1048576).toFixed(1)} MB).`;
      if (await ask($('endDialog')) === 'save') download(`conversation.${ext()}`, currentAudio());
    }
  }
  recorder = null; mediaStream = null;
}
$('start').onclick = start; $('stop').onclick = stop;

// Exports
const label = s => `${s.speaker ? `Speaker ${s.speaker}: ` : ''}`;
$('exportTxt').onclick = () => download('transcript.txt', segments.map(s => `[${fmt(s.t)}] ${label(s)}${s.text}\n         → ${s.translation}`).join('\n\n'), 'text/plain');
$('exportJson').onclick = () => download('transcript.json', JSON.stringify(segments, null, 2), 'application/json');
$('exportSrt').onclick = () => {
  const ts = ms => { const d = new Date(ms).toISOString(); return d.slice(11, 23).replace('.', ','); };
  download('subtitles.srt', segments.map((s, i) => `${i + 1}\n${ts(s.t)} --> ${ts((segments[i + 1]?.t ?? s.t + 3000))}\n${s.translation}\n`).join('\n'), 'text/plain');
};
$('clear').onclick = () => { if (!segments.length || confirm('Clear the transcript?')) { segments = []; render(); } };
render();
