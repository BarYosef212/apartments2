import { getState, resume, saveSettings } from './limits.js';

const $ = (id) => document.getElementById(id);
const time = (ms) => new Date(ms).toLocaleString('he-IL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

async function render() {
  const { settings, count, nextAllowedAt, pausedUntil } = await getState();
  $('count').textContent = count;
  $('cap').textContent = settings.dailyCap;
  $('dailyCap').value = settings.dailyCap;
  $('minGap').value = settings.minGapMinutes;
  $('next').textContent =
    count >= settings.dailyCap
      ? 'הגעתם למכסה של היום. מחר אפשר שוב.'
      : nextAllowedAt > Date.now()
        ? `הקבוצה הבאה אפשרית מ־${time(nextAllowedAt)}`
        : 'אפשר לפרסם עכשיו';
  $('paused').hidden = !(pausedUntil > Date.now());
  $('pausedUntil').textContent = time(pausedUntil);
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings({ dailyCap: $('dailyCap').value, minGapMinutes: $('minGap').value });
  render();
});

$('resume').addEventListener('click', async () => {
  if (confirm('לחדש את הפרסום לפני שעברו 48 שעות? זה מגדיל את הסיכון לחסימה.')) {
    await resume();
    render();
  }
});

render();
