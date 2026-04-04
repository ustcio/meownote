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
  animation: hao-fade-in 0.5s ease;
}

@keyframes hao-fade-in {
  from { opacity: 0; transform: translateY(12px); }
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
  color: #b7b7b7;
  text-decoration: none;
  transition: all 0.15s ease;
  padding: 4px 0;
}

.hao-back-link:hover {
  color: var(--color-primary, #d97757);
  transform: translateX(-3px);
}

.hao-back-link:hover svg {
  transform: translateX(-2px);
}

.hao-back-link svg {
  transition: transform 0.15s ease;
}

/* Title & Description - wallpaper site style */
.hao-tool-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
  margin-top: 0.65rem;
  margin-bottom: 0.3rem;
  letter-spacing: -0.01em;
  line-height: 1.2;
  text-shadow: 0 0 16px rgba(0,0,0,0.5);
}

[data-theme="light"] .hao-tool-title {
  color: #282828;
  text-shadow: 0 0 16px rgba(255,255,255,0.5);
}

.hao-tool-desc {
  font-size: 0.82rem;
  color: #b7b7b7;
  margin: 0;
  text-shadow: 0 0 8px rgba(0,0,0,0.4);
}

[data-theme="light"] .hao-tool-desc {
  color: #909098;
  text-shadow: 0 0 8px rgba(255,255,255,0.4);
}

/* --- Tool Card: Neumorphic Outer Shadow --- */
.hao-tool-card {
  background: var(--col-bg-nt, #e0e0e0);
  border-radius: 1.15rem;
  padding: 1.5rem;
  box-shadow:
    3px 3px 10px var(--col-bg-start, #949494),
    -3px -3px 10px var(--col-bg-end, #fff);
  transition: all 0.3s ease;
}

@media (min-width: 768px) {
  .hao-tool-card {
    padding: 2rem;
  }
}

[data-theme="dark"] .hao-tool-card {
  background: #282828;
  box-shadow:
    3px 3px 10px #191919,
    -3px -3px 10px #514b51;
}

/* --- Neumorphic Input (Inner Shadow) --- */
:deep(.hao-input) {
  width: 100%;
  background: var(--col-bg-nt, #e0e0e0);
  border: none;
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  color: inherit;
  font-size: 0.88rem;
  outline: none;
  box-shadow:
    inset 3px 3px 6px var(--col-bg-start, #949494),
    inset -3px -3px 6px var(--col-bg-end, #fff);
  transition: all 0.2s ease;
  font-family: -apple-system, Arial, Helvetica, sans-serif;
  resize: vertical;
  line-height: 1.5;
}

:deep(.hao-input:focus) {
  box-shadow:
    inset 3px 3px 6px var(--col-bg-start, #949494),
    inset -3px -3px 6px var(--col-bg-end, #fff),
    0 0 0 2px rgba(217, 119, 87, 0.2);
}

:deep(.hao-input::placeholder) {
  color: #909098;
}

[data-theme="dark"] :deep(.hao-input) {
  background: #282828;
  box-shadow:
    inset 3px 3px 6px #191919,
    inset -3px -3px 6px #514b51;
  color: #fff;
}

/* --- Neumorphic Press Button --- */
:deep(.hao-press-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  border-radius: 0.75rem;
  border: none;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: inherit;
  transition: all 0.15s cubic-bezier(0.2, 0, 0.2, 1);
  user-select: none;
  -webkit-user-select: none;
  font-family: -apple-system, Arial, Helvetica, sans-serif;
}

:deep(.hao-press-btn:active) {
  transform: scale(0.85);
  box-shadow:
    inset 3px 3px 6px var(--col-bg-start),
    inset -3px -3px 6px var(--col-bg-end) !important;
}

:deep(.hao-press-btn--primary) {
  background: var(--color-primary, #d97757);
  color: #fffdf9;
  box-shadow:
    2px 2px 6px var(--col-bg-start, #949494),
    -2px -2px 6px var(--col-bg-end, #fff),
    0 6px 16px rgba(201,105,71,0.15);
}

:deep(.hao-press-btn--primary:hover) {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

:deep(.hao-press-btn--secondary) {
  background: var(--col-bg-nt, #e0e0e0);
  color: #7b7979;
  box-shadow:
    2px 2px 6px var(--col-bg-start, #949494),
    -2px -2px 6px var(--col-bg-end, #fff);
}

:deep(.hao-press-btn--secondary:hover) {
  color: #514b51;
}

[data-theme="dark"] :deep(.hao-press-btn--secondary) {
  background: #282828;
  color: #b7b7b7;
  box-shadow:
    2px 2px 6px #191919,
    -2px -2px 6px #514b51;
}

/* --- Neumorphic Result Area (Inner) --- */
:deep(.hao-result) {
  background: var(--col-bg-nt, #e0e0e0);
  border-radius: 0.75rem;
  padding: 0.85rem 1rem;
  box-shadow:
    inset 3px 3px 6px var(--col-bg-start, #949494),
    inset -3px -3px 6px var(--col-bg-end, #fff);
  color: #514b51;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.82rem;
  word-break: break-all;
  line-height: 1.6;
  min-height: 52px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

[data-theme="dark"] :deep(.hao-result) {
  background: #282828;
  box-shadow:
    inset 3px 3px 6px #191919,
    inset -3px -3px 6px #514b51;
  color: #e0e0e0;
}

/* --- Label --- */
:deep(.hao-label) {
  font-size: 0.82rem;
  font-weight: 500;
  color: #b7b7b7;
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
  background: rgba(217, 119, 87, 0.08);
  border-radius: 0.6rem;
  font-size: 0.78rem;
  color: #b7b7b7;
  line-height: 1.5;
}

:deep(.hao-info svg) {
  flex-shrink: 0;
  color: var(--color-primary, #d97757);
}

/* --- Copy Button --- */
:deep(.hao-copy-btn) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  background: transparent;
  border: 1px solid rgba(183, 183, 183, 0.2);
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #b7b7b7;
  cursor: inherit;
  transition: all 0.15s ease;
}

:deep(.hao-copy-btn:hover) {
  color: var(--color-primary, #d97757);
  border-color: rgba(217, 119, 87, 0.3);
  background: rgba(217, 119, 87, 0.06);
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
  color: #909098;
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .tool-page { animation: none; }
  :deep(.hao-press-btn),
  :deep(.hao-copy-btn) { transition: none; }
}
</style>
