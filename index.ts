import {performance} from'node:perf_hooks'
import fs from'node:fs'

export interface BenchOpts {
  /** Warmup time, in milliseconds. Default: 3000 */
  warmupTime: number,

  /** Test minimum time, in milliseconds. Default: 10000 */
  testTime: number,

  /** Minimum samples. Default 100 */
  samples: number,

  /** Test name */
  name?: string,

  /** Quiet mode. (Don't print anything) */
  quiet: boolean,
}

const defaultOpts: BenchOpts = {
  warmupTime: 3000,
  testTime: 10000,
  samples: 100,
  // name: "unnamed test",
  quiet: false,
}

export interface BenchmarkReport {
  meanTime: number,
  options: BenchOpts,
  // Samples times?
}

export const reports: Record<string, BenchmarkReport> = {}

const roundDigits = (n: number, digits: number) => {
  const m = Math.pow(10, digits)
  return Math.round(n * m) / m
}

const round = (n: number): number => (
  n < 1 ? roundDigits(n, 3)
    : n < 10 ? roundDigits(n, 2)
    : n < 100 ? roundDigits(n, 1)
    : Math.round(n)
)

export function bench(options: BenchOpts | string, fn: () => void) {
  const opts: BenchOpts =
    options == null ? defaultOpts
    : typeof options === 'string' ? { ...defaultOpts, name: options }
    : { ...defaultOpts, ...options }

  // First, we'll run it for 3 seconds to warm up the JS VM.

  let start = performance.now()
  let end
  let warmupCount = 0
  if (!opts.quiet) console.warn(`Running test ${opts.name ?? 'unknown'}. Warmup for ${round(opts.warmupTime / 1000)} seconds...`)
  do {
    fn()
    warmupCount++
    end = performance.now()
  } while (end - start < opts.warmupTime)

  if (!opts.quiet) console.warn(`Did ${warmupCount} iterations in ${round(end - start)} ms (Estimate: ${round((end - start) / warmupCount)} ms)`)

  let timePerIteration = (end - start) / warmupCount

  // We want to run for at least 100 samples and run for 10 seconds.
  const samples = Math.max(opts.samples, Math.floor(opts.testTime / timePerIteration))
  if (!opts.quiet) console.warn(`Running ${samples} samples in an estimated ${round(timePerIteration * samples / 1000)} seconds`)

  // TODO: Consider discarding
  start = performance.now()
  for (let i = 0; i < samples; i++) {
    fn()
  }
  end = performance.now()
  timePerIteration = (end - start) / samples

  if (!opts.quiet) console.warn(`Time per iteration: ${round(timePerIteration)} ms`)

  if (opts.name != null) {
    reports[opts.name] = {
      meanTime: timePerIteration, options: opts
    }
  }
}

export function saveReportsSync(filename = 'report.json') {
  // Try to merge the report with other reports.
  let currentReports = {}
  try {
    currentReports = JSON.parse(fs.readFileSync(filename, 'utf8'))

    if (typeof currentReports !== 'object' || currentReports == null) {
      throw Error('Report file is not an object')
    }
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      console.error('Cannot merge report with existing file')
      throw e
    }
  }

  const merged = {...currentReports, ...reports}
  fs.writeFileSync(filename, JSON.stringify(merged, null, 2))
  console.warn('Saved benchmarking reports to', filename)
}
