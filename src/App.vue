<template>
  <div class="bhumi-admin">
    <router-view />
  </div>
</template>

<script setup>
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Satoshi:wght@300;400;500;700&display=swap');
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  /* Core - True AMOLED */
  --bg-base: #000000;
  --bg-surface: #060606;
  --bg-elevated: #0C0C0C;
  --bg-hover: #121212;
  --bg-overlay: rgba(0, 0, 0, 0.92);
  --bg-card: #080808;

  /* Luxury Gold Palette */
  --gold: #C9A96E;
  --gold-light: #D4B87A;
  --gold-bright: #E2CC9C;
  --gold-dark: #A68B5B;
  --gold-subtle: #8B7355;
  --gold-bg: rgba(201, 169, 110, 0.06);
  --gold-bg-hover: rgba(201, 169, 110, 0.1);
  --gold-border: rgba(201, 169, 110, 0.15);
  --gold-border-strong: rgba(201, 169, 110, 0.3);
  --gold-glow: rgba(201, 169, 110, 0.08);

  /* Champagne */
  --champagne: #E8D5B5;
  --champagne-dim: rgba(232, 213, 181, 0.6);

  /* Warm Rose */
  --rose: #B76E79;
  --rose-light: #C98A94;
  --rose-bg: rgba(183, 110, 121, 0.06);
  --rose-border: rgba(183, 110, 121, 0.15);

  /* Status Colors - Muted & Refined */
  --success: #7DB87D;
  --success-bg: rgba(125, 184, 125, 0.06);
  --success-border: rgba(125, 184, 125, 0.15);

  --warning: #C4A86E;
  --warning-bg: rgba(196, 168, 110, 0.06);
  --warning-border: rgba(196, 168, 110, 0.15);

  --danger: #B86B6B;
  --danger-bg: rgba(184, 107, 107, 0.06);
  --danger-border: rgba(184, 107, 107, 0.15);

  --info: #6B9DB8;
  --info-bg: rgba(107, 157, 184, 0.06);
  --info-border: rgba(107, 157, 184, 0.15);

  /* Text Hierarchy */
  --text-primary: #F0EDE8;
  --text-secondary: #9A9590;
  --text-tertiary: #6B6660;
  --text-muted: #4A4640;

  /* Borders - Ultra Subtle */
  --border: 1px solid rgba(255, 255, 255, 0.04);
  --border-light: 1px solid rgba(255, 255, 255, 0.03);
  --border-strong: 1px solid rgba(255, 255, 255, 0.08);
  --border-focus: 1px solid var(--gold);

  /* Radius - Minimal, Refined */
  --radius: 4px;
  --radius-sm: 2px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* Typography */
  --font-sans: 'Satoshi', -apple-system, sans-serif;
  --font-display: 'Fraunces', Georgia, serif;
  --font-mono: 'SF Mono', 'JetBrains Mono', monospace;

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
  --space-20: 80px;
  --space-24: 96px;

  /* Transitions - Smooth, Premium Feel */
  --transition-fast: 120ms cubic-bezier(0.25, 0.1, 0.25, 1);
  --transition-base: 200ms cubic-bezier(0.25, 0.1, 0.25, 1);
  --transition-slow: 350ms cubic-bezier(0.25, 0.1, 0.25, 1);
  --transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Layout */
  --sidebar-width: 240px;
  --sidebar-collapsed: 56px;
  --topbar-height: 56px;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: var(--font-sans);
  font-weight: 400;
  background: var(--bg-base);
  color: var(--text-primary);
  line-height: 1.6;
  letter-spacing: 0.01em;
}

/* Scrollbar - Invisible Elegance */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius);
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}

/* Selection */
::selection {
  background: var(--gold);
  color: var(--bg-base);
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
  letter-spacing: 0.02em;
  border-radius: var(--radius);
  border: var(--border);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
  user-select: none;
  line-height: 1.5;
  position: relative;
  overflow: hidden;
}

.btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-primary {
  background: var(--gold);
  color: var(--bg-base);
  border-color: var(--gold);
  font-weight: 600;
}

.btn-primary:hover:not(:disabled) {
  background: var(--gold-light);
  border-color: var(--gold-light);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.06);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: rgba(255, 255, 255, 0.1);
}

.btn-success {
  background: var(--success);
  color: var(--bg-base);
  border-color: var(--success);
  font-weight: 600;
}

.btn-success:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-danger {
  background: transparent;
  color: var(--danger);
  border-color: var(--danger-border);
}

.btn-danger:hover:not(:disabled) {
  background: var(--danger-bg);
  border-color: var(--danger);
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

.btn-gold {
  background: transparent;
  color: var(--gold);
  border-color: var(--gold-border);
}

.btn-gold:hover:not(:disabled) {
  background: var(--gold-bg);
  border-color: var(--gold-border-strong);
}

.btn-sm {
  padding: var(--space-1) var(--space-3);
  font-size: 12px;
}

.btn-lg {
  padding: var(--space-3) var(--space-6);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.btn-icon {
  width: 32px;
  height: 32px;
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
  border-color: rgba(255, 255, 255, 0.08);
}

.input:focus, select.input:focus {
  outline: none;
  border-color: var(--gold);
  background: var(--bg-surface);
  box-shadow: 0 0 0 3px var(--gold-bg);
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
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6660' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

/* ===== CARDS ===== */
.card {
  background: var(--bg-surface);
  border: var(--border);
  border-radius: var(--radius-md);
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
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
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
  letter-spacing: 0.02em;
  border-radius: var(--radius-sm);
  white-space: nowrap;
  line-height: 1.4;
}

.badge-gold {
  background: var(--gold-bg);
  color: var(--gold-light);
  border: 1px solid var(--gold-border);
}

.badge-success {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.badge-danger {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid var(--danger-border);
}

.badge-info {
  background: var(--info-bg);
  color: var(--info);
  border: 1px solid var(--info-border);
}

.badge-warning {
  background: var(--warning-bg);
  color: var(--warning);
  border: 1px solid var(--warning-border);
}

.badge-rose {
  background: var(--rose-bg);
  color: var(--rose-light);
  border: 1px solid var(--rose-border);
}

/* Legacy badge classes for compatibility */
.badge-green { composes: badge-success; }
.badge-red { composes: badge-danger; }
.badge-cyan { composes: badge-info; }
.badge-yellow { composes: badge-warning; }
.badge-blue { composes: badge-info; }
.badge-orange { composes: badge-warning; }
.badge-purple { composes: badge-gold; }

/* ===== TABLE ===== */
.table-wrapper {
  overflow-x: auto;
  border: var(--border);
  border-radius: var(--radius-md);
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table thead th {
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border-bottom: var(--border);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  text-align: left;
  white-space: nowrap;
}

.table tbody td {
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border-light);
  font-size: 14px;
  vertical-align: middle;
  color: var(--text-secondary);
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

.table tbody td:first-child {
  color: var(--text-primary);
}

/* ===== ANIMATIONS ===== */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.02); opacity: 0.8; }
}

.animate-fadeIn { animation: fadeIn 0.3s ease-out; }
.animate-fadeInUp { animation: fadeInUp 0.4s ease-out; }
.animate-fadeInDown { animation: fadeInDown 0.3s ease-out; }
.animate-pulse { animation: pulse-soft 2s ease-in-out infinite; }
.animate-spin { animation: spin 0.8s linear infinite; }
.animate-shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(201, 169, 110, 0.04) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

/* ===== UTILITY ===== */
.text-gold { color: var(--gold-light); }
.text-success { color: var(--success); }
.text-danger { color: var(--danger); }
.text-info { color: var(--info); }
.text-warning { color: var(--warning); }
.text-rose { color: var(--rose-light); }
.text-muted { color: var(--text-muted); }
.text-champagne { color: var(--champagne); }

.text-xs { font-size: 12px; }
.text-sm { font-size: 13px; }
.text-base { font-size: 14px; }
.text-lg { font-size: 16px; }
.text-xl { font-size: 20px; }
.text-2xl { font-size: 24px; }
.text-3xl { font-size: 32px; }

.font-light { font-weight: 300; }
.font-normal { font-weight: 400; }
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
  max-width: 1400px;
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
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
  line-height: 1.3;
  font-variation-settings: "SOFT" 50, "WONK" 0;
}

.page-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
  font-weight: 300;
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
  border-radius: var(--radius-md);
  padding: var(--space-6);
  position: relative;
  transition: all var(--transition-base);
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-border), transparent);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.stat-card:hover {
  border-color: var(--gold-border);
  background: var(--bg-elevated);
}

.stat-card:hover::before {
  opacity: 1;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  line-height: 1;
  margin-bottom: var(--space-2);
  letter-spacing: -0.02em;
  font-variation-settings: "SOFT" 50, "WONK" 0;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
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
  font-size: 40px;
  opacity: 0.2;
  color: var(--gold-subtle);
}

.empty-state-text {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-tertiary);
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
  width: 24px;
  height: 24px;
  border: 1.5px solid rgba(255, 255, 255, 0.06);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ===== DIVIDER ===== */
.divider {
  height: 1px;
  background: var(--border);
  border: none;
}

.divider-gold {
  background: linear-gradient(90deg, transparent, var(--gold-border), transparent);
}

/* bhumi-admin root */
.bhumi-admin {
  min-height: 100vh;
  background: var(--bg-base);
}

/* Page Transitions */
.page-enter-active {
  transition: opacity var(--transition-slow), transform var(--transition-slow);
}

.page-leave-active {
  transition: opacity var(--transition-base), transform var(--transition-base);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
