import type { Clues, Identifier, LogicalExpression } from '../compiler/ast.ts'
import { checkClue, parseClue } from './clueEval.ts'

/** Matrix of possible options. */
export type Matrix = Record<string, boolean[]>
export type IterationState = {
	/** Matrix of possible values (item - house). */
	matrix: Matrix,
	/** Clues to process with their state. */
	clues: LogicalExpression[],
}
export type SolverConfig = {
	/** Categories and their items. */
	categories: Record<string, string[]>,
	/** Categories that can have missing items. */
	greatCategories: string[],
	/** Mapping of short names to full names. */
	nameKV: Record<string, string>,
	/** All item options in the matrix. */
	itemOptions: string[],
	/** Number of houses. */
	count: number,
	/** Precomputed combinations for elimination. */
	combinations: number[][][],
	/** Maximum number of iterations to perform. */
	maximumIterations: number,
	/** Statistics about the solving process. */
	stats: {
		iteration: number,
		option: number,
	},
}
export type Solved = {
	/** Whether all options have been solved. */
	done: boolean,
	/** Stack of options for further iterations. */
	optionStack: IterationState[],
	/** Number of iterations performed. */
	iterations: number,
	/** Number of options processed. */
	options: number,
	/** Found solutions. */
	solutions: Matrix[],
	/**
	 * Generates the solution matrix in a human-readable format.
	 * @param matrix The solution matrix to print.
	 * @returns String of the formatted solution.
	 */
	solutionString: (matrix: Matrix) => string,
}

/**
 * Solves the logic puzzle given the categories and clues.
 * @param categories Categories and their items.
 * @param clues Clues to process.
 * @param maximumIterations Maximum number of iterations to perform.
 * @param inputOptionStack Initial option stack for iterative solving.
 * @param greatCategories Categories that can have missing items.
 */
export function solve(
	{
		categories,
		clues,
		maximumIterations = 20,
		optionStack: inputOptionStack,
		greatCategories = [],
	}: {
		categories: Record<string, string[]>
		clues: Clues
		maximumIterations?: number
		optionStack?: IterationState[]
		greatCategories?: string[]
	},
): Solved {
	const { nameKV, itemOptions, count } = shortNamesMap(categories, greatCategories)
	const combinations = generateAllCombinations(count)
	const initialMatrix = generateInitialMatrix(categories, itemOptions, count)
	
	const stats = {
		iteration: 0,
		option: 0,
		solutions: [] as Matrix[],
	}
	
	const sc: SolverConfig = {
		categories,
		nameKV,
		itemOptions,
		count,
		combinations,
		maximumIterations,
		stats,
		greatCategories,
	}
	
	let [done, optionStack] = runIterations({ matrix: initialMatrix, clues: clues.body })
	
	return {
		done,
		optionStack,
		solutionString: finalGrid,
		iterations: stats.iteration,
		options: stats.option,
		solutions: stats.solutions,
	}
	
	function runIterations(state: IterationState): [boolean, IterationState[]] {
		const { stats, maximumIterations } = sc
		let optionStack: IterationState[] = inputOptionStack ?? [structuredClone(state)]
		let newOptionStack: IterationState[] = []
		for (stats.iteration = 0; stats.iteration < maximumIterations; stats.iteration++) {
			if (optionStack.length == 0) return [true, []]
			for (const state of optionStack) {
				stats.option++
				const solved = solveOption(state)
				//printMatrix(m);return
				if (solved != 0) continue
				let minimumOptions = Infinity
				let minimumCategory = ''
				let minimumCol = -1
				for (const category in categories) {
					for (let col = 0; col < count; col++) {
						let count = 0
						for (const item of categories[category]) {
							if (state.matrix[`${category}.${item}`][col]) count++
						}
						if (count > 1 && count < minimumOptions) {
							minimumOptions = count
							minimumCategory = category
							minimumCol = col
						}
					}
				}
				//console.log(`Expanding options for ${minimumItem} (${minimumOptions} options)...`)
				for (const item of categories[minimumCategory]) {
					if (state.matrix[`${minimumCategory}.${item}`][minimumCol]) {
						const newState = structuredClone(state)
						for (const it of categories[minimumCategory]) {
							newState.matrix[`${minimumCategory}.${it}`][minimumCol] = false
						}
						newState.matrix[`${minimumCategory}.${item}`][minimumCol] = true
						newOptionStack.push(newState)
					}
				}
			}
			optionStack = structuredClone(newOptionStack)
			newOptionStack = []
		}
		return [optionStack.length == 0, optionStack]
	}
	
	function solveOption(state: IterationState) {
		iterationLoop:
			while (true) {
				const snapshot = structuredClone(state.matrix)
				iteration(state)
				for (const key in state.matrix) {
					for (let i = 0; i < count; i++) {
						if (state.matrix[key][i] != snapshot[key][i]) continue iterationLoop
					}
				}
				break // no changes made
			}
		
		let allSolved = true
		for (const category in categories) {
			let colHas = Array(count).fill(false)
			for (const item of categories[category]) {
				const trueIndexes = state.matrix[`${category}.${item}`]
					.map<[boolean, number]>((b, i) => [b, i])
					.filter(([b]) => b)
				if (trueIndexes.length > 1) allSolved = false
				if (trueIndexes.length == 0) {
					if (!sc.greatCategories.includes(category)) return -1 // this option is invalid
				}
				for (const ti of trueIndexes) {
					if (colHas[ti[1]]) allSolved = false
					colHas[ti[1]] = true
				}
			}
			if (colHas.includes(false)) return -1 // this option is invalid
		}
		for (const clue of state.clues) {
			for (let d = 1; d <= count; d++) {
				if (!checkClue(clue, state.matrix, id => parseIdentifier(id, d), sc)) return -2
				if (!clue.dollar) break
			}
		}
		if (allSolved) {
			stats.solutions.push(state.matrix)
		}
		return allSolved ? 1 : 0
	}
	
	function iteration(state: IterationState) {
		for (const clue of state.clues) {
			for (let d = 1; d <= count; d++) {
				parseClue(clue, state.matrix, id => parseIdentifier(id, d), sc)
				if (!clue.dollar) break
			}
		}
		eliminateImpossibleOptions(state.matrix, sc)
	}
	
	function printMatrix(m: Matrix) {
		let longestCategoryItemName = 0
		for (const category in categories) {
			for (const item of categories[category] ?? []) {
				if (item.length > longestCategoryItemName) longestCategoryItemName = item.length
			}
		}
		for (const category in categories) {
			if (category == '#') continue
			console.log('-'.repeat(longestCategoryItemName + 5 + count * 3))
			for (const item of categories[category] ?? []) {
				console.log(`| ${item}${' '.repeat(longestCategoryItemName - item.length)} |${m[`${category}.${item}`].map(v => v ? ' ■ ' : ' □ ').join('')}|`)
			}
		}
		console.log('-'.repeat(longestCategoryItemName + 5 + count * 3))
	}
	
	function finalGrid(matrix: Matrix) {
		let out = ''
		let longestName = 0
		for (const category in categories) {
			if (category.length > longestName) longestName = category.length
			for (const item of categories[category] ?? []) {
				if (item.length > longestName) longestName = item.length
			}
		}
		const m = structuredClone(matrix)
		for (const ctg in categories) {
			for (const item of categories[ctg] ?? []) {
				if (m[`${ctg}.${item}`].filter(v => v).length != 1) {
					m[`${ctg}.${item}`] = Array(count).fill(false)
				}
			}
		}
		out += '-'.repeat((longestName + 3) * (count + 1) + 1) + '\n'
		out += `| ${pad('')} | ${Array(count).fill(0).map((_, i) =>
			pad(' '.repeat(longestName / 2 - 0.5) + `${i + 1}`),
		).join(' | ')} |\n`
		out += '-'.repeat((longestName + 3) * (count + 1) + 1) + '\n'
		for (const ctg in categories) {
			if (ctg == '#') continue
			out += `| ${pad(ctg)} | ${
				Array(count).fill(0).map((_, i) =>
					pad(categories[ctg].map(item =>
						m[`${ctg}.${item}`][i] ? item : '',
					).join('')),
				).join(' | ')
			} |\n`
		}
		
		out += '-'.repeat((longestName + 3) * (count + 1) + 1)
		
		function pad(str: string) {
			return str + ' '.repeat(longestName - str.length)
		}
		
		return out
	}
	
	function parseIdentifier(identifier: Identifier, dollar: number = 1) {
		const name = nameKV[identifier.symbol] ?? identifier.symbol
		if (name.startsWith('#')) {
			return '#.' + name.replace(/[#.]/g, '')
		}
		if (name == '$') {
			return `#.${dollar}`
		}
		if (!itemOptions.includes(name)) throw new SolverError(`Identifier ${identifier.symbol} not found.`, identifier.pos)
		return name
	}
	
}


function shortNamesMap(categories: Record<string, string[]>, greatCategories: string[]) {
	if (Object.values(categories).length === 0) throw new SolverError('No categories provided.', [1, 1])
	const count = Object.entries(categories).find(([name]) => !greatCategories.includes(name))[1].length
	const kva: [string, string][] = []
	let items: string[] = []
	for (const category in categories) {
		if (categories[category]!.length !== count) {
			if (!greatCategories.includes(category)) throw new SolverError('All categories must have the same number of items.', [1, 1])
		}
		for (const item of categories[category] ?? []) {
			let found = false
			items.push(`${category}.${item}`)
			for (let i = 0; i < kva.length; i++) {
				if (kva[i]![0] == item) {
					kva.splice(i, 1)
					found = true
					break
				}
			}
			if (!found) kva.push([item, `${category}.${item}`])
		}
	}
	return {
		nameKV: Object.fromEntries(kva),
		itemOptions: items,
		count,
	}
}

function generateAllCombinations(count: number) {
	const combinations: number[][][] = [[]]
	for (let i = 1; i < count; i++) {
		combinations.push(generateCombinations(count, i))
	}
	return combinations
}

function generateCombinations(n: number, k: number): number[][] {
	const result: number[][] = []
	const combination: number[] = []
	
	function backtrack(start: number, depth: number) {
		if (depth === k) {
			result.push([...combination])
			return
		}
		for (let i = start; i < n; i++) {
			combination.push(i)
			backtrack(i + 1, depth + 1)
			combination.pop()
		}
	}
	
	backtrack(0, 0)
	return result
}

function generateInitialMatrix(categories: Record<string, string[]>, itemOptions: string[], count: number) {
	const matrix: Matrix = {}
	for (const item of itemOptions) {
		matrix[item] = Array(count).fill(true)
	}
	categories['#'] = []
	for (let i = 0; i < count; i++) {
		const arr = Array(count).fill(false)
		arr[i] = true
		matrix[`#.${i + 1}`] = arr
		categories['#'][i] = `${i + 1}`
	}
	return matrix
}

function eliminateImpossibleOptionsByCategory(matrix: Matrix, category: string, sc: SolverConfig) {
	const rows: { row: boolean[], idx: number }[] = []
	for (let i = 0; i < sc.count; i++) {
		const item = (sc.categories[category] as string[])[i]
		rows.push({
			row: matrix[`${category}.${item}`],
			idx: i,
		})
	}
	for (let count = 1; count < sc.count; count++) {
		const requiredRows = sc.count - count
		const columnCombinations = sc.combinations[count]
		for (const combination of columnCombinations) {
			const matchingRows = rows
				.filter(({ row }) => combination.every(col => !row[col]))
				.map(({ idx }) => idx)
			if (matchingRows.length < requiredRows) continue
			for (let i = 0; i < count; i++) {
				if (matchingRows.includes(i)) continue
				for (let j = 0; j < count; j++) {
					if (combination.includes(j)) continue
					const item = sc.categories[category][i]
					matrix[`${category}.${item}`][j] = false
				}
			}
		}
	}
}

export function eliminateImpossibleOptions(m: Matrix, sc: SolverConfig) {
	for (const category in sc.categories) {
		eliminateImpossibleOptionsByCategory(m, category, sc)
	}
}

export class SolverError extends Error {
	/** Position in the source code where the error occurred. */
	public readonly position: [number, number, number?]
	
	/**
	 * Creates a new SolverError.
	 * @param message Error message.
	 * @param position Position in the source code where the error occurred.
	 */
	constructor(message: string, position: [number, number, number?]) {
		super(`Error at [${position.join(':')}]: ${message}`)
		this.position = position
	}
}