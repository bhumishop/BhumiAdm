import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { edgeApi } from '../api/edgeApi'
import type {
  EdgeFunctionConfig,
  UserSession,
  UserGeolocation,
  OperationLog,
  OtelSpan,
  OtelMetric,
  InfraOverview,
  OrchestratorNode,
  OrchestratorEdge,
} from '../types'

export const useInfraOrchestratorStore = defineStore('infraOrchestrator', () => {
  // Edge function state
  const edgeFunctions = ref<EdgeFunctionConfig[]>([])
  const selectedFunction = ref<EdgeFunctionConfig | null>(null)
  const functionTestResult = ref<Record<string, unknown> | null>(null)
  const functionTestArgs = ref<Record<string, string>>({})

  // User session state
  const activeSessions = ref<UserSession[]>([])
  const sessionCount = ref({ active_sessions: 0, total_sessions: 0 })

  // Geolocation state
  const geolocations = ref<UserGeolocation[]>([])
  const mapData = ref<UserGeolocation[]>([])
  const activeUsersWithGeo = ref<Record<string, unknown>[]>([])

  // Operation logs state
  const operationLogs = ref<OperationLog[]>([])
  const logFilter = ref({ status: '', operation: '', limit: 50 })

  // OpenTelemetry state
  const otelSpans = ref<OtelSpan[]>([])
  const otelMetrics = ref<OtelMetric[]>([])
  const otelAnalysis = ref<Record<string, unknown> | null>(null)
  const selectedTrace = ref<Record<string, unknown> | null>(null)

  // Orchestrator graph state
  const orchestratorNodes = ref<OrchestratorNode[]>([])
  const orchestratorEdges = ref<OrchestratorEdge[]>([])
  const selectedOrchestratorNode = ref<OrchestratorNode | null>(null)

  // Overview stats
  const overview = ref<InfraOverview | null>(null)

  // Loading/error state
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed: function status counts
  const functionStatusCounts = computed(() => ({
    active: edgeFunctions.value.filter(f => f.status === 'active').length,
    degraded: edgeFunctions.value.filter(f => f.status === 'degraded').length,
    error: edgeFunctions.value.filter(f => f.status === 'error').length,
    inactive: edgeFunctions.value.filter(f => f.status === 'inactive').length,
    total: edgeFunctions.value.length,
  }))

  // Computed: filtered logs
  const filteredLogs = computed(() => {
    let logs = operationLogs.value
    if (logFilter.value.status) {
      logs = logs.filter(l => l.status === logFilter.value.status)
    }
    if (logFilter.value.operation) {
      logs = logs.filter(l => l.operation === logFilter.value.operation)
    }
    return logs.slice(0, logFilter.value.limit)
  })

  // Computed: error logs count
  const errorLogsCount = computed(() => operationLogs.value.filter(l => l.status === 'error').length)

  // Computed: active users count
  const activeUsersCount = computed(() => activeSessions.value.filter(s => s.is_active).length)

  // ============================================
  // Edge Functions Management
  // ============================================

  async function fetchEdgeFunctions() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.infraManager.getFunctions()
      edgeFunctions.value = (result.data as unknown as EdgeFunctionConfig[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch edge functions'
      console.error('fetchEdgeFunctions error:', err)
    } finally {
      loading.value = false
    }
  }

  async function updateFunctionStatus(functionName: string, updates: { status?: string; config?: Record<string, unknown> }) {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.infraManager.updateFunction(functionName, updates)
      const idx = edgeFunctions.value.findIndex(f => f.function_name === functionName)
      if (idx >= 0) {
        edgeFunctions.value[idx] = { ...edgeFunctions.value[idx], ...result.data } as EdgeFunctionConfig
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to update function'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function testEdgeFunction(functionName: string, args: Record<string, unknown> = {}) {
    loading.value = true
    error.value = null
    functionTestResult.value = null
    try {
      const result = await edgeApi.infraManager.testFunction(functionName, args)
      functionTestResult.value = result.data || null
      // Refresh function status after test
      await fetchEdgeFunctions()
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to test function'
      functionTestResult.value = { error: error.value }
    } finally {
      loading.value = false
    }
  }

  function selectFunction(fn: EdgeFunctionConfig | null) {
    selectedFunction.value = fn
    functionTestArgs.value = {}
    functionTestResult.value = null
  }

  // ============================================
  // User Sessions
  // ============================================

  async function fetchActiveSessions() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.userTracker.getSessions(true)
      activeSessions.value = (result.data as unknown as UserSession[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch sessions'
    } finally {
      loading.value = false
    }
  }

  async function fetchSessionCounts() {
    try {
      const result = await edgeApi.userTracker.getSessionCounts()
      sessionCount.value = result.data || { active_sessions: 0, total_sessions: 0 }
    } catch (err: unknown) {
      console.error('fetchSessionCounts error:', err)
    }
  }

  async function fetchActiveUsersWithGeo() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.userTracker.getActiveUsersWithGeo()
      activeUsersWithGeo.value = result.data || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch active users'
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Geolocation
  // ============================================

  async function fetchMapData() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.userTracker.getMapData()
      const data = (result.data as unknown as UserGeolocation[]) || []
      mapData.value = data
      geolocations.value = data
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch geolocations'
    } finally {
      loading.value = false
    }
  }

  async function fetchUserGeolocations(userId?: string) {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.userTracker.getGeolocations(userId)
      geolocations.value = (result.data as unknown as UserGeolocation[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user geolocations'
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Operation Logs
  // ============================================

  async function fetchOperationLogs() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.infraManager.getLogs(logFilter.value.limit)
      operationLogs.value = (result.data as unknown as OperationLog[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch logs'
    } finally {
      loading.value = false
    }
  }

  function setLogFilter(updates: { status?: string; operation?: string; limit?: number }) {
    logFilter.value = { ...logFilter.value, ...updates }
  }

  // ============================================
  // OpenTelemetry
  // ============================================

  async function fetchOtelSpans(traceId?: string, limit = 50) {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.telemetryCollector.getSpans(traceId, undefined, undefined, undefined, limit)
      otelSpans.value = (result.data as unknown as OtelSpan[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch spans'
    } finally {
      loading.value = false
    }
  }

  async function fetchFullTrace(traceId: string) {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.telemetryCollector.getTrace(traceId)
      selectedTrace.value = result.data || null
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch trace'
    } finally {
      loading.value = false
    }
  }

  async function fetchOtelMetrics(name?: string, hours = 24) {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.telemetryCollector.getMetrics(name, undefined, hours, 100)
      otelMetrics.value = (result.data as unknown as OtelMetric[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch metrics'
    } finally {
      loading.value = false
    }
  }

  async function fetchOtelAnalysis(hours = 24) {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.telemetryCollector.getAnalysis(hours)
      otelAnalysis.value = result.data || null
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch analysis'
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Orchestrator Graph
  // ============================================

  async function fetchOrchestratorGraph() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.infraManager.getOrchestratorGraph()
      orchestratorNodes.value = (result.data?.nodes as unknown as OrchestratorNode[]) || []
      orchestratorEdges.value = (result.data?.edges as unknown as OrchestratorEdge[]) || []
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch orchestrator graph'
    } finally {
      loading.value = false
    }
  }

  function selectOrchestratorNode(node: OrchestratorNode | null) {
    selectedOrchestratorNode.value = node
  }

  // ============================================
  // Overview
  // ============================================

  async function fetchOverview() {
    loading.value = true
    error.value = null
    try {
      const result = await edgeApi.infraManager.getOverview()
      overview.value = (result.data?.overview as unknown as InfraOverview) || null
      if (result.data?.functions) {
        edgeFunctions.value = (result.data.functions as unknown as EdgeFunctionConfig[]) || []
      }
      if (result.data?.sessions) {
        activeSessions.value = (result.data.sessions as unknown as UserSession[]) || []
      }
      if (result.data?.recent_operations) {
        operationLogs.value = (result.data.recent_operations as unknown as OperationLog[]) || []
      }
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch overview'
    } finally {
      loading.value = false
    }
  }

  // ============================================
  // Bulk refresh
  // ============================================

  async function refreshAll() {
    await Promise.allSettled([
      fetchOverview(),
      fetchActiveSessions(),
      fetchSessionCounts(),
      fetchMapData(),
      fetchOperationLogs(),
      fetchOtelAnalysis(),
    ])
  }

  return {
    // State
    edgeFunctions,
    selectedFunction,
    functionTestResult,
    functionTestArgs,
    activeSessions,
    sessionCount,
    geolocations,
    mapData,
    activeUsersWithGeo,
    operationLogs,
    logFilter,
    otelSpans,
    otelMetrics,
    otelAnalysis,
    selectedTrace,
    orchestratorNodes,
    orchestratorEdges,
    selectedOrchestratorNode,
    overview,
    loading,
    error,

    // Computed
    functionStatusCounts,
    filteredLogs,
    errorLogsCount,
    activeUsersCount,

    // Actions
    fetchEdgeFunctions,
    updateFunctionStatus,
    testEdgeFunction,
    selectFunction,
    fetchActiveSessions,
    fetchSessionCounts,
    fetchActiveUsersWithGeo,
    fetchMapData,
    fetchUserGeolocations,
    fetchOperationLogs,
    setLogFilter,
    fetchOtelSpans,
    fetchFullTrace,
    fetchOtelMetrics,
    fetchOtelAnalysis,
    fetchOrchestratorGraph,
    selectOrchestratorNode,
    fetchOverview,
    refreshAll,
  }
})
