<template>
  <div class="bhumi-admin">
    <router-view />
  </div>
</template>

<script setup>
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  /* Core Colors */
  --bg-base: #08080a;
  --bg-surface: #0f0f13;
  --bg-elevated: #16161d;
  --bg-hover: #1c1c26;
  --bg-overlay: rgba(8, 8, 10, 0.95);

  /* Accent Colors */
  --purple: #8B5CF6;
  --purple-light: #A78BFA;
  --purple-lighter: #C4B5FD;
  --purple-dark: #7C3AED;
  --purple-bg: rgba(139, 92, 246, 0.08);
  --purple-border: rgba(139, 92, 246, 0.2);

  --green: #22C55E;
  --green-light: #4ADE80;
  --green-bright: #00FF41;
  --green-dark: #16A34A;
  --green-bg: rgba(34, 197, 94, 0.08);
  --green-border: rgba(34, 197, 94, 0.2);

  --red: #EF4444;
  --red-light: #F87171;
  --red-dark: #DC2626;
  --red-bg: rgba(239, 68, 68, 0.08);
  --red-border: rgba(239, 68, 68, 0.2);

  --cyan: #06B6D4;
  --cyan-light: #22D3EE;
  --cyan-bg: rgba(6, 182, 212, 0.08);
  --cyan-border: rgba(6, 182, 212, 0.2);

  --yellow: #EAB308;
  --yellow-light: #FACC15;
  --yellow-bg: rgba(234, 179, 8, 0.08);
  --yellow-border: rgba(234, 179, 8, 0.2);

  --blue: #3B82F6;
  --blue-light: #60A5FA;
  --blue-bg: rgba(59, 130, 246, 0.08);
  --blue-border: rgba(59, 130, 246, 0.2);

  --orange: #F97316;
  --orange-bg: rgba(249, 115, 22, 0.08);
  --orange-border: rgba(249, 115, 22, 0.2);

  /* Text */
  --text-primary: #FAFAFA;
  --text-secondary: #A1A1AA;
  --text-tertiary: #71717A;
  --text-muted: #52525B;

  /* Borders */
  --border: 1px solid rgba(255, 255, 255, 0.06);
  --border-strong: 1px solid rgba(255, 255, 255, 0.1);
  --border-focus: 2px solid var(--purple);

  /* Radius */
  --radius: 0px;
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;

  /* Typography */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-display: 'Space Grotesk', sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Transitions */
  --transition-fast: 100ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 250ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Layout */
  --sidebar-width: 260px;
  --sidebar-collapsed: 64px;
  --topbar-height: 60px;

  /* Shadows - Subtle flat depth */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.4);
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--text-primary);
  line-height: 1.6;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Selection */
::selection {
  background: var(--purple);
  color: white;
}

/* Focus */
:focus-visible {
  outline: var(--border-focus);
  outline-offset: 2px;
}

/* ===== BUTTONS ===== */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius);
  border: var(--border);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
  user-select: none;
  line-height: 1.5;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-primary {
  background: var(--purple);
  color: white;
  border-color: var(--purple);
}

.btn-primary:hover:not(:disabled) {
  background: var(--purple-dark);
  border-color: var(--purple-dark);
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: rgba(255, 255, 255, 0.15);
}

.btn-success {
  background: var(--green);
  color: white;
  border-color: var(--green);
}

.btn-success:hover:not(:disabled) {
  background: var(--green-dark);
  border-color: var(--green-dark);
}

.btn-danger {
  background: var(--red);
  color: white;
  border-color: var(--red);
}

.btn-danger:hover:not(:disabled) {
  background: var(--red-dark);
  border-color: var(--red-dark);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: transparent;
}

.btn-ghost:hover:not(:disabled) {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.btn-sm {
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
}

.btn-lg {
  padding: var(--space-3) var(--space-6);
  font-size: 15px;
  font-weight: 600;
}

.btn-icon {
  width: 36px;
  height: 36px;
  padding: 0;
}

/* ===== INPUTS ===== */
.input, select.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: var(--border);
  border-radius: var(--radius);
  transition: all var(--transition-base);
  line-height: 1.5;
}

.input::placeholder {
  color: var(--text-muted);
}

.input:hover, select.input:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.input:focus, select.input:focus {
  outline: none;
  border-color: var(--purple);
  background: var(--bg-surface);
}

.input-sm {
  padding: var(--space-1) var(--space-2);
  font-size: 13px;
}

.input-lg {
  padding: var(--space-3) var(--space-4);
  font-size: 15px;
}

select.input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

/* ===== CARDS ===== */
.card {
  background: var(--bg-surface);
  border: var(--border);
  border-radius: var(--radius);
}

.card-header {
  padding: var(--space-5) var(--space-6);
  border-bottom: var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.card-header h3 {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-body {
  padding: var(--space-6);
}

/* ===== BADGES ===== */
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius);
  white-space: nowrap;
  line-height: 1.4;
}

.badge-purple {
  background: var(--purple-bg);
  color: var(--purple-light);
  border: 1px solid var(--purple-border);
}

.badge-green {
  background: var(--green-bg);
  color: var(--green-light);
  border: 1px solid var(--green-border);
}

.badge-red {
  background: var(--red-bg);
  color: var(--red-light);
  border: 1px solid var(--red-border);
}

.badge-cyan {
  background: var(--cyan-bg);
  color: var(--cyan-light);
  border: 1px solid var(--cyan-border);
}

.badge-yellow {
  background: var(--yellow-bg);
  color: var(--yellow-light);
  border: 1px solid var(--yellow-border);
}

.badge-blue {
  background: var(--blue-bg);
  color: var(--blue-light);
  border: 1px solid var(--blue-border);
}

.badge-orange {
  background: var(--orange-bg);
  color: var(--orange);
  border: 1px solid var(--orange-border);
}

/* ===== TABLE ===== */
.table-wrapper {
  overflow-x: auto;
  border: var(--border);
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table thead th {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: var(--border);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: left;
  white-space: nowrap;
}

.table tbody td {
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border);
  font-size: 14px;
  vertical-align: middle;
}

.table tbody tr {
  transition: background var(--transition-fast);
}

.table tbody tr:hover {
  background: var(--bg-hover);
}

.table tbody tr:last-child td {
  border-bottom: none;
}

/* ===== ANIMATIONS ===== */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-fadeIn { animation: fadeIn 0.2s ease-out; }
.animate-slideUp { animation: slideUp 0.3s ease-out; }
.animate-slideDown { animation: slideDown 0.3s ease-out; }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.animate-spin { animation: spin 1s linear infinite; }

/* ===== UTILITY ===== */
.text-purple { color: var(--purple-light); }
.text-green { color: var(--green-light); }
.text-red { color: var(--red-light); }
.text-cyan { color: var(--cyan-light); }
.text-yellow { color: var(--yellow-light); }
.text-blue { color: var(--blue-light); }
.text-muted { color: var(--text-muted); }

.text-xs { font-size: 12px; }
.text-sm { font-size: 14px; }
.text-base { font-size: 16px; }
.text-lg { font-size: 18px; }
.text-xl { font-size: 24px; }

.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }

.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }

.w-full { width: 100%; }

/* ===== PAGE LAYOUT HELPERS ===== */
.page-container {
  max-width: 1440px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8);
  gap: var(--space-6);
  flex-wrap: wrap;
}

.page-title {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.page-subtitle {
  font-size: 15px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.page-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

/* ===== STAT CARDS ===== */
.stat-card {
  background: var(--bg-surface);
  border: var(--border);
  padding: var(--space-6);
  position: relative;
  transition: all var(--transition-base);
}

.stat-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  background: var(--bg-elevated);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
}

.stat-card.purple::before { background: var(--purple); }
.stat-card.green::before { background: var(--green); }
.stat-card.red::before { background: var(--red); }
.stat-card.cyan::before { background: var(--cyan); }
.stat-card.yellow::before { background: var(--yellow); }
.stat-card.blue::before { background: var(--blue); }

.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.stat-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: var(--border);
  font-size: 18px;
}

.stat-icon.purple { background: var(--purple-bg); }
.stat-icon.green { background: var(--green-bg); }
.stat-icon.red { background: var(--red-bg); }
.stat-icon.cyan { background: var(--cyan-bg); }
.stat-icon.yellow { background: var(--yellow-bg); }
.stat-icon.blue { background: var(--blue-bg); }

.stat-value {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: var(--space-2);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* ===== EMPTY STATES ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) var(--space-8);
  text-align: center;
  color: var(--text-muted);
  gap: var(--space-4);
}

.empty-state-icon {
  font-size: 48px;
  opacity: 0.3;
}

.empty-state-text {
  font-size: 15px;
  font-weight: 500;
}

/* ===== LOADING ===== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  gap: var(--space-4);
  color: var(--text-muted);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--purple);
  animation: spin 0.8s linear infinite;
}

/* bhumi-admin root */
.bhumi-admin {
  min-height: 100vh;
  background: var(--bg-base);
}

/* Page Transitions */
.page-enter-active,
.page-leave-active {
  transition: all var(--transition-slow);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
