import type {
	ArithmeticBinaryOperation,
	ArithmeticExpression,
	Identifier,
	InOperator,
	LogicalBinaryOperation,
	LogicalExpression,
	LogicalOperation,
	LogicalUnaryOperation,
	NodeType,
	NumericIdentifier,
	NumericLiteral,
	PositionalOperation,
	RangeLiteral,
	RelationalOperation,
	SetLiteral,
	TruthsOperator,
} from '../compiler/ast.ts'
import type { TokenType } from '../compiler/lexer.ts'
import { eliminateImpossibleOptions, type Matrix, type SolverConfig, SolverError } from './solver.ts'

type IdParser = (id: Identifier) => string
type Evaluator<T extends TokenType> = (token: T, matrix: Matrix, parser: IdParser, sc: SolverConfig) => void | Matrix
type Checker<T extends TokenType> = (token: T, matrix: Matrix, parser: IdParser, sc: SolverConfig) => boolean | never

const clueEvaluators: Partial<Record<NodeType, Record<string, Evaluator<any>>>> = {
	PositionalOperation: {
		'=': (token: PositionalOperation, m, p, sc) => {
			const l = p(token.operands[0])
			const r = p(token.operands[1])
			positionalDistanceEval(m, sc, l, r, 0)
		},
		'-': (token: PositionalOperation, m, p, sc) => {
			const l = p(token.operands[0])
			const r = p(token.operands[1])
			positionalDistanceEval(m, sc, l, r, token.distance ?? 1)
		},
		'--': (token: PositionalOperation, m, p, sc) => {
			const l = p(token.operands[0])
			const r = p(token.operands[1])
			for (let i = 0; i < sc.count; i++) {
				m[r][i] = false
				if (m[l][i]) break
			}
			for (let i = sc.count - 1; i >= 0; i--) {
				m[l][i] = false
				if (m[r][i]) break
			}
		},
	},
	LogicalBinaryOperation: {
		'&': (token: LogicalBinaryOperation, m, p, sc) => {
			parseClue(token.operands[0], m, p, sc)
			parseClue(token.operands[1], m, p, sc)
		},
		'|': (token: LogicalBinaryOperation, m, p, sc) => {
			evalBinaryLogical(token, m, p, sc, (l, r) => l || r)
		},
	},
	LogicalOperation: {
		'&': (token: LogicalOperation, m, p, sc) => {
			for (const clue of token.operands) {
				parseClue(clue, m, p, sc)
			}
		},
		'|': (token: LogicalOperation, m, p, sc) => {
			const snapshots: Matrix[] = token.operands.map(c => {
				const mc: Matrix = structuredClone(m)
				parseClue(c, mc, p, sc)
				eliminateImpossibleOptions(mc, sc)
				return mc
			})
			for (const key in m) {
				for (let i = 0; i < sc.count; i++) {
					if (snapshots.every(s => !s[key][i])) {
						m[key][i] = false
					}
				}
			}
		},
	},
	InOperator: {
		'in': (token: InOperator, m, p, sc) => {
			if (token.operands[0].type == 'Identifier') {
				if (token.operands[1].type != 'SetLiteral') throw new SolverError('Identifier can be only in a SetLiteral.', token.pos)
				const id = token.operands[0] as Identifier
				const l = p(id)
				const set = token.operands[1] as SetLiteral
				const can: boolean[] = Array(sc.count).fill(false)
				for (const s of set.elements) {
					const r = p(s as Identifier)
					for (let i = 0; i < sc.count; i++) {
						if (m[r][i]) can[i] = true
					}
				}
				for (let i = 0; i < sc.count; i++) {
					m[l][i] = m[l][i] && can[i]
				}
			}
		},
	},
	RelationalOperation: {
		'==': (token: RelationalOperation, m, p, sc) => {
			relationalEval(token, m, p, sc, (l, r) => l == r)
		},
		'>': (token: RelationalOperation, m, p, sc) => {
			relationalEval(token, m, p, sc, (l, r) => l > r)
		},
		'<': (token: RelationalOperation, m, p, sc) => {
			relationalEval(token, m, p, sc, (l, r) => l < r)
		},
		'>=': (token: RelationalOperation, m, p, sc) => {
			relationalEval(token, m, p, sc, (l, r) => l >= r)
		},
		'<=': (token: RelationalOperation, m, p, sc) => {
			relationalEval(token, m, p, sc, (l, r) => l <= r)
		},
		'!=': (token: RelationalOperation, m, p, sc) => {
			relationalEval(token, m, p, sc, (l, r) => l != r)
		},
	},
}

const clueCheckers: Partial<Record<NodeType, Record<string, Checker<any>>>> = {
	PositionalOperation: {
		'=': (token: PositionalOperation, m, p, sc) => {
			const l = getTrueIndex(m[p(token.operands[0])])
			const r = getTrueIndex(m[p(token.operands[1])])
			token.solved = l == r
			return token.solved
		},
		'-': (token: PositionalOperation, m, p, sc) => {
			const l = getTrueIndex(m[p(token.operands[0])])
			const r = getTrueIndex(m[p(token.operands[1])])
			token.solved = r - l == (token.distance ?? 1)
			return token.solved
		},
		'--': (token: PositionalOperation, m, p, sc) => {
			const l = getTrueIndex(m[p(token.operands[0])])
			const r = getTrueIndex(m[p(token.operands[1])])
			token.solved = l < r
			return token.solved
		},
	},
	LogicalBinaryOperation: {
		'&': (token: LogicalBinaryOperation, m, p, sc) => {
			const a = checkClueThrowable(token.operands[0], m, p, sc)
			const b = checkClueThrowable(token.operands[1], m, p, sc)
			const out = a && b
			if (token.operands[0].solved !== undefined && token.operands[1].solved !== undefined) token.solved = out
			return out
		},
		'|': (token: LogicalBinaryOperation, m, p, sc) => {
			const a = checkClueThrowable(token.operands[0], m, p, sc)
			const b = checkClueThrowable(token.operands[1], m, p, sc)
			const out = a || b
			if (token.operands[0].solved !== undefined && token.operands[1].solved !== undefined) token.solved = out
			return out
		},
		'^': (token: LogicalBinaryOperation, m, p, sc) => {
			const a = checkClueThrowable(token.operands[0], m, p, sc)
			const b = checkClueThrowable(token.operands[1], m, p, sc)
			const out = a != b
			if (token.operands[0].solved !== undefined && token.operands[1].solved !== undefined) token.solved = out
			return out
		},
		'<=>': (token: LogicalBinaryOperation, m, p, sc) => {
			const a = checkClueThrowable(token.operands[0], m, p, sc)
			const b = checkClueThrowable(token.operands[1], m, p, sc)
			const out = a == b
			if (token.operands[0].solved !== undefined && token.operands[1].solved !== undefined) token.solved = out
			return out
		},
		'=>': (token: LogicalBinaryOperation, m, p, sc) => {
			const a = checkClueThrowable(token.operands[0], m, p, sc)
			const b = checkClueThrowable(token.operands[1], m, p, sc)
			const out = !a || b
			if (token.operands[0].solved !== undefined && token.operands[1].solved !== undefined) token.solved = out
			return out
		},
	},
	LogicalOperation: {
		'&': (token: LogicalOperation, m, p, sc) => {
			let result = true
			let solved = true
			for (const clue of token.operands) {
				if (!checkClueThrowable(clue, m, p, sc)) result = false
				if (clue.solved === undefined) solved = false
			}
			if (solved) token.solved = result
			return result
		},
		'|': (token: LogicalOperation, m, p, sc) => {
			let result = false
			let solved = true
			for (const clue of token.operands) {
				if (checkClueThrowable(clue, m, p, sc)) result = true
				if (clue.solved === undefined) solved = false
			}
			if (solved) token.solved = result
			return result
		},
	},
	LogicalUnaryOperation: {
		'!': (token: LogicalUnaryOperation, m, p, sc) => {
			const out = !checkClueThrowable(token.operands[0], m, p, sc)
			if (token.operands[0].solved !== undefined) token.solved = out
			return out
		},
	},
	InOperator: {
		'in': (token: InOperator, m, p, sc) => {
			if (token.operands[0].type == 'Identifier') {
				if (token.operands[1].type != 'SetLiteral') throw new SolverError('Identifier can be only in a SetLiteral.', token.pos)
				const id = token.operands[0] as Identifier
				const set = token.operands[1] as SetLiteral
				const l = getTrueIndex(m[p(id)])
				for (const s of set.elements) {
					const r = getTrueIndex(m[p(s as Identifier)])
					if (l == r) return true
				}
				return false
			} else if (token.operands[0].returns == 'arithmetic') {
				const val = parseArithmetic(token.operands[0], m, p, sc)
				if(val == null) return true
				if (token.operands[1].type == 'SetLiteral') {
					const set = token.operands[1] as SetLiteral
					for (const item of set.elements) {
						if (item.returns != 'arithmetic') throw new SolverError('This set can only be arithmetic.', token.pos)
						const v = parseArithmetic(item as ArithmeticExpression, m, p, sc)
						if (v == null) return true
						if (v == val) return true
					}
					return false
				} else {
					const range = token.operands[1] as RangeLiteral
					const start = parseArithmetic(range.start, m, p, sc)
					const end = parseArithmetic(range.end, m, p, sc)
					if (start == null || end == null) return true
					return val >= start && val <= end
				}
			}
		},
	},
	RelationalOperation: {
		'==': (token: RelationalOperation, m, p, sc) => {
			return checkRelational(token, m, p, sc, (l, r) => l == r)
		},
		'>': (token: RelationalOperation, m, p, sc) => {
			return checkRelational(token, m, p, sc, (l, r) => l > r)
		},
		'<': (token: RelationalOperation, m, p, sc) => {
			return checkRelational(token, m, p, sc, (l, r) => l < r)
		},
		'>=': (token: RelationalOperation, m, p, sc) => {
			return checkRelational(token, m, p, sc, (l, r) => l >= r)
		},
		'<=': (token: RelationalOperation, m, p, sc) => {
			return checkRelational(token, m, p, sc, (l, r) => l <= r)
		},
		'!=': (token: RelationalOperation, m, p, sc) => {
			return checkRelational(token, m, p, sc, (l, r) => l != r)
		},
	},
}

export function parseClue(clue: LogicalExpression, matrix: Matrix, identifierParser: IdParser, sc: SolverConfig) {
	if (clue.solved !== undefined) return
	const e = clueEvaluators[clue.type]?.[clue.operator]
	if (!e) return
	const m = e(clue, matrix, identifierParser, sc)
	if (m) Object.assign(matrix, m)
}

function evalBinaryLogical(token: LogicalBinaryOperation, m: Matrix, p: IdParser, sc: SolverConfig, ok: (l: boolean, r: boolean) => boolean) {
	const m1 = structuredClone(m)
	const m2 = structuredClone(m)
	parseClue(token.operands[0], m1, p, sc)
	parseClue(token.operands[1], m2, p, sc)
	eliminateImpossibleOptions(m1, sc)
	eliminateImpossibleOptions(m2, sc)
	for (const key in m) {
		for (let i = 0; i < sc.count; i++) {
			if (!ok(m1[key][i], m2[key][i])) {
				m[key][i] = false
			}
		}
	}
}

function positionalDistanceEval(m: Matrix, sc: SolverConfig, l: string, r: string, dist: number) {
	for (let i = 0; i < sc.count - dist; i++) {
		if (!(m[l][i] && m[r][i + dist])) {
			m[l][i] = false
			m[r][i + dist] = false
		}
	}
	for (let i = 0; i < dist; i++) {
		m[l][sc.count - dist + i] = false
		m[r][i] = false
	}
}

function relationalEval(token: RelationalOperation, m: Matrix, p: IdParser, sc: SolverConfig, ok: (l: number, r: number) => boolean) {
	if (token.operands[0].type == 'NumericIdentifier') {
		const r = parseArithmetic(token.operands[1], m, p, sc)
		if (r == null) return
		const id = token.operands[0] as NumericIdentifier
		const idRow = m[p(id as any as Identifier)]
		if (idRow.filter(b => b).length != 1) return
		const pos = idRow.indexOf(true)
		if (!sc.categories[id.category]) throw new SolverError(`Category ${id.category} does not exist.`, token.pos)
		for (const item of sc.categories[id.category]) {
			if (!ok(parseInt(item), r))
				m[`${id.category}.${item}`][pos] = false
		}
	} else if (token.operands[1].type == 'NumericIdentifier') {
		const l = parseArithmetic(token.operands[0], m, p, sc)
		if (l == null) return
		const id = token.operands[1] as NumericIdentifier
		const idRow = m[p(id as any as Identifier)]
		if (idRow.filter(b => b).length != 1) return
		const pos = idRow.indexOf(true)
		if (!sc.categories[id.category]) throw new SolverError(`Category ${id.category} does not exist.`, token.pos)
		for (const item of sc.categories[id.category]) {
			if (!ok(l, parseInt(item)))
				m[`${id.category}.${item}`][pos] = false
		}
	}
}

function parseArithmetic(exp: ArithmeticExpression, m: Matrix, p: IdParser, sc: SolverConfig): number | null {
	if (exp.type == 'NumericLiteral') {
		return (exp as NumericLiteral).value
	} else if (exp.type == 'NumericIdentifier') {
		const id = exp as NumericIdentifier
		const idRow = m[p(id as any as Identifier)]
		if (!sc.categories[id.category]) throw new SolverError(`Category ${id.category} does not exist.`, exp.pos)
		let val: number | null = null
		for (let i = 0; i < idRow.length; i++) {
			if (!idRow[i]) continue
			for (const item of sc.categories[id.category]) {
				if (!m[`${id.category}.${item}`][i]) continue
				const v = parseInt(item)
				if (val == null) val = v
				else if (val != v) return null
			}
		}
		return val
	} else if (exp.type == 'ArithmeticBinaryOperation') {
		const e = exp as ArithmeticBinaryOperation
		const l = parseArithmetic(e.operands[0], m, p, sc)
		const r = parseArithmetic(e.operands[1], m, p, sc)
		if (l == null || r == null) return null
		switch (e.operator) {
			case '+':
				return l + r
			case '-':
				return l - r
			case '*':
				return l * r
			case '/':
				return l / r
			case '%':
				return l % r
			case 'diff':
				return Math.abs(l - r)
			default:
				throw new SolverError(`Unexpected arithmetic operator ${e.operator}.`, exp.pos)
		}
	} else if (exp.type == 'TruthsOperator') {
		const e = exp as TruthsOperator
		let count = 0
		for (const clue of e.operands[0].elements) {
			if (checkClueThrowable(clue as LogicalExpression, m, p, sc)) count++
		}
		return count
	}
}

export function checkClue(clue: LogicalExpression, matrix: Matrix, identifierParser: IdParser, sc: SolverConfig) {
	if (clue.solved !== undefined) return clue.solved
	const c = clueCheckers[clue.type]?.[clue.operator]
	if (!c) return true
	try {
		const clueClone = structuredClone(clue)
		return c(clueClone, matrix, identifierParser, sc)
	} catch (e) {
		return true
	}
}

function checkClueThrowable(clue: LogicalExpression, matrix: Matrix, p: IdParser, sc: SolverConfig) {
	if (clue.solved !== undefined) return clue.solved
	const c = clueCheckers[clue.type]?.[clue.operator]
	if (!c) return true
	return c(clue, matrix, p, sc)
}

function getTrueIndex(ar: boolean[]) {
	let idx = -1
	for (let i = 0; i < ar.length; i++) {
		if (ar[i]) {
			if (idx == -1) idx = i
			else throw true
		}
	}
	if (idx == -1) throw false
	return idx
}

function checkRelational(token: RelationalOperation, m: Matrix, p: IdParser, sc: SolverConfig, ok: (l: number, r: number) => boolean) {
	if (token.states == undefined) token.states = {}
	token.states.l = token.states.l ?? parseArithmetic(token.operands[0], m, p, sc)
	token.states.r = token.states.r ?? parseArithmetic(token.operands[1], m, p, sc)
	if (token.states.l == null || token.states.r == null) return true
	const result = ok(token.states.l, token.states.r)
	token.solved = result
	return result
}