import { run } from '../src/bullshit-guard.js'

const chunks: Buffer[] = []
process.stdin.on('data', (chunk) => chunks.push(chunk))
process.stdin.on('end', async () => {
  const input = Buffer.concat(chunks).toString('utf8')
  const result = await run(input)
  if (result !== null) {
    process.stdout.write(result)
  }
  process.exit(0)
})
