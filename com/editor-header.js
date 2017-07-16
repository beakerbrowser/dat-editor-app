/* globals editor monaco beaker DatArchive Event alert */

import * as yo from 'yo-yo'
import * as sharePopup from './editor-share-popup'
import * as toast from './toast'
import renderDropdownMenuBar from './dropdown-menu-bar'
import {niceDate} from '../lib/time'
import {writeToClipboard} from '../lib/event-handlers'
import toggleable, {closeAllToggleables} from './toggleable'

// globals
// =

var dropMenuState = {}
var isEditingTitle = false

// exported api
// =

export function update (archive, path, activeUrl, isOwner, isEditable) {
  if (!archive) {
    return
  }
  path = path || ''
  let readonly = isOwner ? '' : yo`<span class="readonly"><i class="fa fa-eye"></i> Read-only</span>`
  return yo.update(document.querySelector('.editor-header'), yo`
    <header class="editor-header">
      <a class="bigbutton" href="beaker://library" title="Open your library">
        <i class="fa fa-caret-left"></i>
      </a>
      <div class="main">
        <div class="path">
          ${rArchiveName(archive, isOwner)}
          ${rFilePath(path)}
        </div>
        ${rMenu(archive, path, isEditable)}
        ${readonly}
        <span class="last-updated">Updated ${niceDate(archive.info.mtime)}</span>
      </div>
      ${rActions(archive, isOwner)}
    </header>`)
}

// renderers
// =

function rArchiveName (archive, isOwner) {
  if (!isOwner) {
    return yo`<div class="archive">${archive.niceName}</div>`
  }
  if (!isEditingTitle) {
    return yo`
      <div class="archive editable" onclick=${e => onStartEditingTitle(archive, isOwner)}>
        ${archive.niceName}
      </div>`
  }
  return yo`
    <div
      class="archive editing"
      onkeydown=${e => onTitleKeydown(e, archive, isOwner)}
      onblur=${e => onStopEditingTitle(archive, isOwner)}
      contenteditable="true"
    >${archive.niceName}</div>`
  // ^ important - dont put whitespace between the text content and the element tags
  // when this becomes a contenteditable, the whitespace gets included as a value
}

function rFilePath (path) {
  if (!path) {
    return ''
  }

  var label
  if (path.startsWith('buffer~~')) {
    label = 'New file'
  } else {
    label = path.split('/').map(part => yo`
      <span> / ${part}</span>
    `)
  }
  return yo`
    <div class="file">${label}</div>
  `
}

function rMenu (archive, path, isEditable) {
  var isUnsavedFile = path.startsWith('buffer~~')
  return renderDropdownMenuBar(dropMenuState, [
    {
      label: 'File',
      menu: [
        {label: 'New file', disabled: !archive.info.isOwner, click: 'new-file'},
        {label: 'New folder', disabled: !archive.info.isOwner, click: 'new-folder'},
        {label: 'Import file(s)...', disabled: !archive.info.isOwner, click: 'import-files'},
        '-',
        {label: '&Save file', disabled: !isEditable, click: 'save-file'},
        {label: 'Rename file', disabled: true},
        {label: 'Delete file', disabled: true},
        '-',
        {label: 'View site', click: () => window.open(archive.url)},
        {label: 'View current file', disabled: isUnsavedFile, click: () => window.open(archive.url + '/' + path)},
        {label: 'Copy URL',
          click: () => {
            writeToClipboard(archive.url)
            toast.create(`URL for ${archive.niceName} copied to clipboard.`)
          }}
      ]
    },
    {
      label: 'Edit',
      menu: [
        {label: 'Undo', disabled: !isEditable, click: () => editor.executeCommand('keyboard', monaco.editor.Handler.Undo)},
        {label: 'Redo', disabled: !isEditable, click: () => editor.executeCommand('keyboard', monaco.editor.Handler.Redo)},
        '-',
        {label: 'Cut', disabled: !isEditable, click: () => { editor.focus(); document.execCommand('cut') }},
        {label: 'Copy', disabled: !isEditable, click: () => { editor.focus(); document.execCommand('copy') }},
        {label: 'Paste', disabled: !isEditable, click: () => { editor.focus(); document.execCommand('paste') }}
      ]
    },
    {
      label: 'Tools',
      menu: [
        {label: 'Create new site', click: onCreate},
        {label: 'Fork this site', click: () => onFork(archive)},
        {label: 'Export site files...', click: () => alert('TODO')},
        '-',
        {label: 'Settings', click: 'open-settings'}
      ]
    }
  ])
}

function rActions (archive, isOwner) {
  let icon = 'fa fa-eye'
  let label = 'Read-only'
  let saveDesc = 'Keep this site permanently and receive updates.'
  let delDesc = 'Stop receiving updates and let the files be deleted.'
  if (isOwner) {
    icon = 'fa fa-pencil'
    label = 'Editing'
    saveDesc = 'Restore from the trash.'
    delDesc = 'Move this site to the trash.'
  }

  return yo`
    <div class="actions">
      <a class="btn" href=${archive.url} target="_blank"><i class="fa fa-external-link"></i> View site</a>
      ${toggleable(yo`
        <div class="dropdown-btn-container">
          <button class="btn toggleable">
            <i class=${icon}></i> ${label} <i class="fa fa-caret-down"></i>
          </button>

          <div class="dropdown-btn-list">
            <div onclick=${e => onFork(archive)}>
              <div class="title"><i class="fa fa-code-fork"></i> Fork this site</div>
              <div class="desc">Create an editable copy of this site.</div>
            </div>
          </div>
        </div>
      `)}
      <button class="btn primary" onclick=${e => onShare(archive)}><i class="fa fa-link"></i> Share</button>
    </div>
  `
}

// event handlers
// =

async function onCreate () {
  var archive = await DatArchive.create()
  window.location = '/' + archive.url.slice('dat://'.length)
}

async function onFork (archive) {
  closeAllToggleables()
  var fork = await DatArchive.fork(archive, {
    title: archive.info.title,
    description: archive.info.description
  })
  window.location = '/' + fork.url.slice('dat://'.length)
}

function onShare (archive) {
  sharePopup.create(archive)
}

function onStartEditingTitle (archive, isOwner) {
  isEditingTitle = true
  var el = document.querySelector('header .archive')

  // re-render
  yo.update(el, rArchiveName(archive, isOwner))

  // focus and select text
  el.focus()
  var range = document.createRange()
  range.selectNodeContents(el)
  var sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

async function onStopEditingTitle (archive, isOwner, ignore) {
  alert('TODO')
  // isEditingTitle = false
  // var el = document.querySelector('header .archive')

  // if (!ignore) {
  //   // grab value
  //   var newTitle = (el.textContent || '').trim()

  //   // update if changed
  //   if (newTitle !== archive.info.title) {
  //     await beaker.archives.updateManifest(archive.url, {title: newTitle})
  //     archive.info.title = newTitle
  //   }
  // }

  // // rerender
  // yo.update(document.querySelector('header .archive'), rArchiveName(archive, isOwner))
}

function onTitleKeydown (e, archive, isOwner) {
  if (e.keyCode === 13 /* enter */) {
    onStopEditingTitle(archive, isOwner)
  }
  if (e.keyCode === 27 /* escape */) {
    onStopEditingTitle(archive, isOwner, true)
  }
}
