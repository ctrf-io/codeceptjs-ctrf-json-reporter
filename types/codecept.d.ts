export interface CodeceptjsTest {
  type: 'test'
  title: string
  body: string
  async: boolean
  sync: boolean
  _timeout: number
  _slow: number
  _retries: number
  timedOut: boolean
  _currentRetry: number
  pending: boolean
  tags: string[]
  file: string
  inject: object
  steps: CodeceptjsStep[]
  parent: Suite
  ctx: Context
  opts: object
  uid: string
  startedAt: number
  artifacts: object
  _events: object
  _eventsCount: number
  retryNum: number
}

export interface CodeceptjsStep {
  actor: string
  helper: object
  name: string
  helperMethod: string
  status: string
  suffix: string
  prefix: string
  comment: string
  args: any[]
  metaStep: undefined | object
  startedAt: number
  test: CodeceptjsTest
  startTime: number
  endTime: number
  finishedAt: number
  duration: number
}

interface Suite {
  title: string
  ctx: Context
  suites: Suite[]
  tests: CodeceptjsTest[]
  root: boolean
  pending: boolean
  _retries: number
  _timeout: number
  _slow: number
  _bail: boolean
  _onlyTests: any[]
  _onlySuites: any[]
  delayed: boolean
  parent: Suite
  opts: object
  tags: string[]
  file: string
}

interface Context {
  _runnable: any
  test: CodeceptjsTest
}
