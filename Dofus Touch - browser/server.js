const express = require('express')
const path    = require('path')
const fs      = require('fs')

const app      = express()
const PORT     = 3000
const GAME_DIR = path.join(__dirname, 'game')

if (!fs.existsSync(GAME_DIR) || !fs.existsSync(path.join(GAME_DIR, 'index.html'))) {
  console.error('\n  Game files not found. Run first:\n\n    node download.js\n')
  process.exit(1)
}

// Serve static game files
app.use(express.static(GAME_DIR, {
  setHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*')
  }
}))

// Root → index.html only
app.get('/', (req, res) => {
  res.sendFile(path.join(GAME_DIR, 'index.html'))
})

// Everything else missing → 404 (prevents index.html being parsed as JSON/sourcemap)
app.use((req, res) => res.status(404).end())

app.listen(PORT, () => {
  console.log('')
  console.log('  dofemu-browser')
  console.log(`  → http://localhost:${PORT}`)
  console.log('    serving local game files from ./game/')
  console.log('')
})