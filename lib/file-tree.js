export default class FileTree {
  constructor(archive, {onDemand} = {}) {
    this.archive = archive
    this.opts = {onDemand}
  }

  async setup () {
    // list all files
    let names = await this.archive.readdir('/', {recursive: !this.opts.onDemand})

    // fetch all entries
    var entries = await Promise.all(names.map(async name => {
      var entry = await this.archive.stat(name)
      entry.name = name
      return entry
    }))

    // construct a tree structure
    this.rootNode = createNode({isDirectory: ()=>true, isFile: ()=>false, name: '/'})
    for (var k in entries) {
      let entry = entries[k]
      var path = entry.name.split('/').filter(Boolean)
      setNode(this.rootNode, path, entry)
    }

    console.log(this)
  }

  // this can be used to add new entries from the outside
  addNode (entry) {
    var path = entry.name.split('/').filter(Boolean)
    setNode(this.rootNode, path, entry)
  }

  // this needs to be used if onDemand == false, to expand folders
  async readFolder (node) {
    // list all files
    let entries = await this.archive.readdir(node.entry.name, {stat: true})

    // add child nodes
    for (var k in entries) {
      var entry = entries[k].stat
      entry.name = node.entry.name + '/' + entries[k].name
      this.addNode(entry)
    }
  }
}

function createNode (entry) {
  var niceName
  var nameParts = entry.name.split('/')
  do {
    niceName = nameParts.pop()
  } while (!niceName && nameParts.length > 0)
  if (entry.isDirectory()) {
    return {entry, niceName, children: {}}
  }
  return {entry, niceName}
}

function setNode (node, path, entry, i=0) {
  var subname = path[i]
  if (i >= path.length - 1) {
    // end of path, set/update the node
    if (!node.children[subname]) {
      node.children[subname] = createNode(entry)
    } else {
      node.children[subname].entry = entry
    }
  } else {
    // make sure folder exists
    if (!node.children[subname]) {
      // put a default folder entry there
      node.children[subname] = createNode({
        isDirectory: ()=>true,
        isFile: ()=>false,
        name: path.slice(0, i + 1).join('/')
      })
    }
    // descend
    setNode(node.children[subname], path, entry, i + 1)
  }
}