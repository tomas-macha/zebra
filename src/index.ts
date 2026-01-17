import { compile, type CompilerError } from './compiler/compiler.ts'
import { parse, parseHeader } from './compiler/parser.ts'
import { type Token, tokenize, type TokenType } from './compiler/lexer.ts'
import { type IterationState, type Matrix, solve, type SolverConfig, SolverError, type Solved } from './solver/solver.ts'

export {
	compile,
	parse,
	parseHeader,
	tokenize,
	solve,
}

export type {
	CompilerError,
	Token,
	TokenType,
	SolverConfig,
	SolverError,
	IterationState,
	Matrix,
	Solved
}

/**
 * Solves the zebra puzzle from the clues input.
 * @param input The clues input as a string (in the zbc syntax).
 * @param iterations The maximum number of iterations to perform.
 * @default iterations 50
 * @returns Found solutions and solver state.
 */
export function solvePuzzle(input: string, iterations = 50) {
	const compiled = compile(input)
	return solve({ ...compiled, maximumIterations: iterations })
}

/**
 * Creates an iterative solver function for the given puzzle input.
 * @param input The clues input as a string (in the zbc syntax).
 * @returns A function that takes the number of iterations and returns the solver result.
 */
export function iterativeSolver(input: string) {
	const compiled = compile(input)
	let optionStack: IterationState[] | undefined = undefined
	return function iteration(iterations: number) {
		const res = solve({ ...compiled, maximumIterations: iterations, optionStack })
		optionStack = res.optionStack
		return res
	}
}
