/**
 * Structured, request-id-correlated logging (PRD §10 / Fix #12).
 *
 * Convex captures stdout/stderr per function execution and can forward it to a
 * log stream (Axiom/Datadog) and exception reporter (Sentry). We emit compact
 * JSON lines so those sinks can parse and alert. The scoring engine and
 * subscription-enforcement paths additionally emit a distinguishable
 * `severity: "critical"` error event and rethrow - they fail loudly, never
 * silently (PRD §11).
 */

export type LogSeverity = "info" | "warn" | "error" | "critical";

export interface LogFields {
  event: string;
  fn: string;
  requestId?: string;
  managerId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

function emit(severity: LogSeverity, fields: LogFields): void {
  const line = JSON.stringify({
    severity,
    ts: new Date().toISOString(),
    ...fields,
  });
  if (severity === "error" || severity === "critical") {
    console.error(line);
  } else if (severity === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logInfo = (fields: LogFields) => emit("info", fields);
export const logWarn = (fields: LogFields) => emit("warn", fields);
export const logError = (fields: LogFields) => emit("error", fields);

/**
 * Run a critical section (scoring / subscription enforcement). Any thrown error
 * is logged as `critical` (so alerting fires) and then rethrown unchanged - the
 * caller must not receive a silent fallback value.
 */
export async function critical<T>(
  fn: string,
  context: Omit<LogFields, "event" | "fn">,
  body: () => Promise<T>,
): Promise<T> {
  try {
    return await body();
  } catch (err) {
    emit("critical", {
      event: "critical_path_failure",
      fn,
      error: err instanceof Error ? err.message : String(err),
      ...context,
    });
    throw err;
  }
}
