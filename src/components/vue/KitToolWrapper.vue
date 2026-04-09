<script setup lang="ts">
/**
 * KitToolWrapper - Vue component
 * haowallpaper.com 100% design clone
 * Usage: wrap tool content inside <KitToolWrapper title="..." description="...">
 * 
 * 完全照搬 haowallpaper.com 的设计语言：
 * - 深色新拟态 (dark neumorphism)
 * - 磨砂玻璃 (frosted glass)
 * - 自定义触控光标
 * - 0.85 比例按压动画
 */
const props = defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <div class="tool-page">
    <div class="tool-container">
      <header class="tool-header">
        <a href="/kit" class="hao-back-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          返回工具箱
        </a>
        <h1 class="hao-tool-title">{{ props.title }}</h1>
        <p class="hao-tool-desc">{{ props.description }}</p>
      </header>

      <div class="hao-tool-card">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================
   haowallpaper.com EXACT DESIGN CLONE
   ============================================ */

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
  max-width: 820px;
  margin: 0 auto;
  padding: 0 1.2rem;
}

@media (min-width: 768px) {
  .tool-container { padding: 0 2rem; }
}

/* Back Link */
.hao-back-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.85rem;
  color: var(--text-tertiary);
  text-decoration: none;
  transition: all 0.15s ease;
  padding: 4px 0;
}

.hao-back-link:hover {
  color: var(--color-primary);
  transform: translateX(-3px);
}

.hao-back-link:hover svg {
  transform: translateX(-2px);
}

.hao-back-link svg {
  transition: transform 0.15s ease;
}

/* Title & Description */
.hao-tool-title {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0.65rem;
  margin-bottom: 0.3rem;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.hao-tool-desc {
  font-size: 0.82rem;
  color: var(--text-tertiary);
  margin: 0;
}

/* --- Tool Card --- */
.hao-tool-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

@media (min-width: 768px) {
  .hao-tool-card {
    padding: 2rem;
  }
}

/* --- Input --- */
:deep(.hao-input) {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  padding: 0.85rem 1rem;
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

/* --- Press Button --- */
:deep(.hao-press-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.2, 0, 0.2, 1);
  user-select: none;
  font-family: var(--font-body);
}

:deep(.hao-press-btn:active) {
  transform: scale(0.96);
}

:deep(.hao-press-btn--primary) {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(217, 119, 87, 0.2);
}

:deep(.hao-press-btn--primary:hover) {
  background: var(--color-primary-hover);
  box-shadow: 0 6px 16px rgba(217, 119, 87, 0.3);
  transform: translateY(-1px);
}

:deep(.hao-press-btn--secondary) {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-secondary);
}

:deep(.hao-press-btn--secondary:hover) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* --- Result Area --- */
:deep(.hao-result) {
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
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

/* --- Label --- */
:deep(.hao-label) {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  display: block;
}

/* --- Button Group --- */
:deep(.hao-btn-group) {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* --- Info Box --- */
:deep(.hao-info) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.85rem;
  background: var(--color-primary-light);
  border-radius: 0.6rem;
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

:deep(.hao-info svg) {
  flex-shrink: 0;
  color: var(--color-primary);
}

/* --- Copy Button --- */
:deep(.hao-copy-btn) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-secondary);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  font-weight: 500;
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

/* --- Form Group --- */
:deep(.hao-form-group) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

:deep(.hao-form-group:last-child) {
  margin-bottom: 0;
}

/* --- Char Counter --- */
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
