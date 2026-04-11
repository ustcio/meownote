<script setup lang="ts">
/**
 * KitToolWrapper - 工具页面统一包装
 * 与首页设计语言一致
 */
const props = defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="tool-page">
    <div class="tool-container">

      <!-- header -->
      <header class="tool-header">
        <span class="tool-kicker">Kit</span>
        <a href="/kit/" class="tool-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Back to Kit</span>
        </a>
        <h1 class="tool-title">{{ props.title }}</h1>
        <p class="tool-desc">{{ props.description }}</p>
      </header>

      <!-- main card -->
      <div class="tool-main">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== Page ===== */
.tool-page {
  min-height: 80vh;
  padding: 0.5rem 0 3rem;
  animation: hao-fade-in 0.4s ease;
}

@keyframes hao-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.tool-container {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 1.2rem;
}

@media (min-width: 768px) {
  .tool-container { padding: 0 2rem; }
}

/* ===== Header ===== */
.tool-header {
  margin-bottom: 1.5rem;
}

.tool-kicker {
  font-size: 0.68rem;
  font-weight: var(--font-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-primary);
  display: block;
  margin-bottom: 0.5rem;
}

.tool-back-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.82rem;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: all 0.15s ease;
  padding: 4px 0;
  margin-bottom: 0.75rem;
}

.tool-back-link:hover {
  color: var(--color-primary);
}

.tool-back-link:hover svg {
  transform: translateX(-2px);
}

.tool-back-link svg {
  transition: transform 0.15s ease;
}

.tool-title {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.035em;
  line-height: 1.1;
}

.tool-desc {
  font-size: 0.88rem;
  color: var(--text-tertiary);
  margin: 0;
  line-height: 1.55;
  max-width: 36rem;
}

/* ===== Main Card ===== */
.tool-main {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

@media (min-width: 768px) {
  .tool-main { padding: 2rem; }
}

/* ===== Input ===== */
:deep(.hao-input) {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1rem;
  color: var(--text-primary);
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  font-family: var(--font-body);
  resize: vertical;
  line-height: 1.5;
}

:deep(.hao-input:focus) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-alpha-10);
}

:deep(.hao-input::placeholder) {
  color: var(--text-quaternary);
}

/* ===== Primary Button ===== */
:deep(.hao-press-btn--primary) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.65rem var(--space-5);
  border: none;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: var(--font-body);
  min-height: 2.5rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

:deep(.hao-press-btn--primary:hover) {
  background: var(--color-primary-active);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

:deep(.hao-press-btn--primary:active) {
  transform: translateY(0);
}

/* ===== Secondary Button ===== */
:deep(.hao-press-btn--secondary) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.6rem var(--space-5);
  background: transparent;
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-full);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: var(--font-body);
  min-height: 2.4rem;
}

:deep(.hao-press-btn--secondary:hover) {
  background: var(--bg-secondary);
  border-color: var(--border-hover);
}

:deep(.hao-press-btn) {
  user-select: none;
}

:deep(.hao-press-btn:active) {
  transform: scale(0.98);
}

/* ===== Result ===== */
:deep(.hao-result) {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: 0.85rem 1rem;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  word-break: break-all;
  line-height: 1.6;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ===== Label ===== */
:deep(.hao-label) {
  font-size: 0.8rem;
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  display: block;
  letter-spacing: -0.01em;
}

/* ===== Button Group ===== */
:deep(.hao-btn-group) {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* ===== Info Box ===== */
:deep(.hao-info) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: var(--color-primary-light);
  border-radius: var(--radius-lg);
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

:deep(.hao-info svg) {
  flex-shrink: 0;
  color: var(--color-primary);
}

/* ===== Copy Button ===== */
:deep(.hao-copy-btn) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

:deep(.hao-copy-btn:hover) {
  color: var(--color-primary);
  border-color: var(--color-primary-alpha-20);
  background: var(--color-primary-subtle);
}

:deep(.hao-copy-btn:active) {
  transform: scale(0.95);
}

/* ===== Form Group ===== */
:deep(.hao-form-group) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

:deep(.hao-form-group:last-child) {
  margin-bottom: 0;
}

/* ===== Counter ===== */
:deep(.hao-counter) {
  font-size: 0.72rem;
  color: var(--text-quaternary);
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .tool-page { animation: none; }
  :deep(.hao-press-btn),
  :deep(.hao-copy-btn) { transition: none; }
}
</style>
