<script setup lang="ts">
import type { LeakReport } from '../../types'

defineProps<{
  report: LeakReport
}>()
</script>

<template>
  <div class="report">
    <div class="report-header">
      <span class="report-title">AI Analysis</span>
      <span class="report-event">{{ report.event }}</span>
    </div>

    <div v-if="report.leaked_candidates.length > 0" class="candidates">
      <div class="candidates-title">Leak Candidates ({{ report.leaked_candidates.length }})</div>
      <div
        v-for="candidate in report.leaked_candidates.slice(0, 5)"
        :key="candidate.name"
        class="candidate"
      >
        <span class="candidate-name">{{ candidate.name }}</span>
        <span class="candidate-count">
          {{ candidate.before }} → {{ candidate.after }}
        </span>
      </div>
      <div v-if="report.leaked_candidates.length > 5" class="more">
        +{{ report.leaked_candidates.length - 5 }} more...
      </div>
    </div>

    <div v-if="report.analysis" class="analysis">
      <div class="analysis-title">Analysis</div>
      <p class="analysis-text">{{ report.analysis }}</p>
    </div>

    <div v-if="report.recommendations?.length" class="recommendations">
      <div class="recommendations-title">Recommendations</div>
      <ul class="recommendations-list">
        <li v-for="(rec, i) in report.recommendations" :key="i">{{ rec }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.report {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #333;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.report-title {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.report-event {
  font-size: 11px;
  color: #888;
}

.candidates-title,
.analysis-title,
.recommendations-title {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.candidates {
  margin-bottom: 10px;
}

.candidate {
  display: flex;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
}

.candidate-name {
  color: #ef4444;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.candidate-count {
  color: #888;
  font-variant-numeric: tabular-nums;
}

.more {
  font-size: 11px;
  color: #666;
  text-align: center;
  padding: 4px;
}

.analysis {
  margin-bottom: 10px;
}

.analysis-text {
  font-size: 12px;
  line-height: 1.5;
  color: #ccc;
}

.recommendations-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.6;
  color: #22c55e;
}

.recommendations-list li {
  margin-bottom: 4px;
}
</style>
