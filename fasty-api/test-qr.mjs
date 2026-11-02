import { initBaileysSock, getBaileyStatus } from './src/services/baileys.service.js'

const mockApp = {
  log: {
    info: (msg) => console.log('[INFO]', msg),
    warn: (msg) => console.log('[WARN]', msg),
    error: (msg) => console.log('[ERROR]', msg),
  },
  db: {},
}

console.log('Testing Baileys QR generation...')
try {
  await initBaileysSock(mockApp)
  console.log('✓ Baileys initialized')
  
  // Wait untuk QR generate
  await new Promise(r => setTimeout(r, 3000))
  
  const status = getBaileyStatus()
  console.log('Status:', status)
  console.log('QR available:', !!status.qr)
  
  if (status.qr) {
    console.log('✓ QR Code generated successfully!')
    console.log('QR preview (first 100 chars):', status.qr.substring(0, 100) + '...')
  }
} catch (err) {
  console.error('✗ Error:', err.message)
}

process.exit(0)
