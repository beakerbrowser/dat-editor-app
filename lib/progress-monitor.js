import EventTarget from './event-target'
import {throttle} from './functions'

// constants
// =

// how much time to wait between throttle emits
const EMIT_CHANGED_WAIT = 30

export default class ProgressMonitor extends EventTarget {
  constructor(archive) {
    super()
    this.archive = archive
    this.networkActivity = null
    this.downloaded = 0
    this.blocks = -1
    this.isDownloading = false

    // create a throttled 'change' emiter
    this.emitChanged = throttle(() => this.dispatchEvent({type: 'changed'}), EMIT_CHANGED_WAIT)
  }

  setup() {
    // start watching network activity
    this.networkActivity = this.archive.createNetworkActivityStream()
    this.networkActivity.addEventListener('download', this.onDownload.bind(this))
    this.interval = setInterval(() => this.fetchAllStats(), 10e3) // refetch stats every 10s
    return this.fetchAllStats()
  }

  async fetchAllStats() {
    // list all files
    var entries = await this.archive.readdir('/', {recursive: true, stat: true}) 

    // count blocks
    this.downloaded = 0
    this.blocks = 0
    entries.forEach(entry => {
      this.downloaded += entry.stat.downloaded
      this.blocks += entry.stat.blocks
    })
  }

  destroy() {
    clearInterval(this.interval)
    this.listeners = {}
    if (this.networkActivity) {
      this.networkActivity.close()
    }
  }

  get current() {
    return Math.min(Math.round(this.downloaded / this.blocks * 100), 100)
  }

  get isComplete() {
    return this.downloaded >= this.blocks
  }

  onDownload(e) {
    // we dont need perfect precision --
    // rather than check if the block is one of ours, assume it is
    // we'll refetch the full stats every 10s to correct inaccuracies
    // (and we shouldnt be downloading historic data anyway)
    this.downloaded++

    // is this a block in one of our files?
    // for (var k in this.allfiles) {
    //   let file = this.allfiles[k]
    //   let block = e.block - file.content.blockOffset
    //   if (block >= 0 && block < file.blocks) {
    //     file.downloaded++
    //     this.downloaded++
    //   }
    // }
    this.emitChanged()
  }
}