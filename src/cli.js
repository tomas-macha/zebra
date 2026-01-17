#!/usr/bin/env node
import fs from 'fs'
import { iterativeSolver } from '../dist/index.js'

const args = process.argv.slice(2)

const file = args[0]
if (!file) {
	console.error('Please provide a puzzle file path as the first argument.')
	process.exit(1)
}

const content = fs.readFileSync(file, 'utf8')
const solver = iterativeSolver(content)

let iter = parseInt(args[1]) || 50

let totalIterations = 0

while (true) {
	const timeStart = Date.now()
	const solved = solver(iter)
	const deltaT = Date.now() - timeStart
	for (const sol of solved.solutions) {
		console.log('--- Solution ---')
		console.log(solved.solutionString(sol))
	}
	console.log(`Tried ${solved.iterations} iterations, found ${solved.solutions.length} solution(s) in ${deltaT}ms:`)
	if (solved.done) {
		console.log('All possible solutions have been found.')
		break
	}
	totalIterations += solved.iterations
	console.log(`Maximum iterations reached, more solutions may exist. Current stack ${solved.optionStack.length} items. Total iterations: ${totalIterations}`)
	console.log(`Enter new iteration count to continue or 'q' to quit:`)
	const input = await new Promise(resolve => {
		process.stdin.once('data', data => resolve(data.toString().trim()))
	})
	if (input.toLowerCase() === 'q') {
		break
	}
	iter = parseInt(input) || iter
}

process.exit(0)
