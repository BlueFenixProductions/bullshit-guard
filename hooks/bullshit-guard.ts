import { run } from '../src/bullshit-guard.js'

const chunks: Buffer[] = []
process.stdin.on('data', (chunk) => chunks.push(chunk))
process.stdin.on('end', () => {
  const input = Buffer.concat(chunks).toString('utf8')
  const result = run(input)
  if (result !== null) {
    process.stdout.write(result)
  }
})
