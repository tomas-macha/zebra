import type {
	ArithmeticBinaryOperation,
	ArithmeticExpression,
	Clues,
	Expression,
	Identifier,
	InOperator,
	LogicalBinaryOperation,
	LogicalExpression,
	LogicalOperation,
	LogicalUnaryOperation,
	NumericIdentifier,
	NumericLiteral,
	PositionalOperation,
	RangeLiteral,
	RelationalOperation,
	SetLiteral,
	TruthsOperator,
} from './ast.ts'

import { type Token, TokenType } from './lexer.ts'
import { CompilerError } from './compiler.ts'

/**
 * Parses a list of tokens into an abstract syntax tree (AST) representing clues.
 * @param tokens - The list of clue tokens to parse.
 * @returns The parsed clues as an AST.
 */
export function parse(tokens: Token[]): Clues {
	
	const clues: Clues = {
		type: 'Clues',
		body: [],
		returns: 'other',
		pos: [1, 1],
		dollar: false,
	}
	
	//console.log(tokens)
	
	while (notEof()) {
		const exp = parseExpression()
		if (!isLogical(exp)) error('Top-level expressions must be logical.', exp)
		clues.body.push(exp)
	}
	
	return clues
	
	function notEof() {
		return tokens[0]?.type != TokenType.EOF
	}
	
	function at() {
		return tokens[0]!
	}
	
	function eat() {
		return tokens.shift()!
	}
	
	function error(err: string, t: { pos: [number, number, number?] }, detail?: any): never {
		throw new CompilerError(err, [t.pos[0], t.pos[1]], detail ?? t)
	}
	
	function isLogical(expression: Expression): expression is LogicalExpression {
		return expression.returns == 'logical'
	}
	
	function isArithmetic(expression: Expression): expression is ArithmeticExpression {
		return expression.returns == 'arithmetic'
	}
	
	function isIdentifier(expression: Expression): expression is Identifier {
		return expression.type == 'Identifier'
	}
	
	function isSetLiteral(expression: Expression): expression is SetLiteral {
		return expression.type == 'SetLiteral'
	}
	
	function isRangeLiteral(expression: Expression): expression is RangeLiteral {
		return expression.type == 'RangeLiteral'
	}
	
	function parseExpression(): Expression {
		return parseLogicalExpression()
	}
	
	function parseLogicalExpression(): Expression {
		if (at().type == TokenType.LogicalOperator) {
			const token = eat()
			const operator = token.value
			if (operator == '!') {
				const expr = parseLogicalExpression()
				if (!isLogical(expr)) error('Operand of logical NOT must be logical.', expr)
				return {
					type: 'LogicalUnaryOperation',
					operator: operator,
					operands: [expr],
					returns: 'logical',
					pos: [...token.pos, 1],
					dollar: expr.dollar,
				} as LogicalUnaryOperation
			}
			if (operator != '||' && operator != '&&') error('Only &&, || and ! logical operators can be used as prefix operators.', token)
			const set = parsePrimaryExpression()
			if (!isSetLiteral(set)) error('Expected set literal after logical operator prefix.', set)
			return {
				type: 'LogicalOperation',
				operator: operator.charAt(0),
				operands: set.elements as LogicalExpression[],
				returns: 'logical',
				pos: [...token.pos, operator.length],
				dollar: set.elements.some(e => e.dollar),
			} as LogicalOperation
		}
		let left = parseRelationalOrPositionalExpression()
		while (at().type == TokenType.LogicalOperator && !['&&', '||', '!'].includes(at().value)) {
			const operator = eat()
			const right = at().type == TokenType.LogicalOperator
				? parseLogicalExpression()
				: parseRelationalOrPositionalExpression()
			if (!isLogical(left)) error('Left operand of logical expression must be logical.', left)
			if (!isLogical(right)) error('Right operand of logical expression must be logical.', right)
			left = {
				type: 'LogicalBinaryOperation',
				operands: [left, right],
				operator: operator.value,
				returns: 'logical',
				pos: [...operator.pos, operator.value.length],
				dollar: left.dollar || right.dollar,
			} as LogicalBinaryOperation
		}
		return left
	}
	
	function parseRelationalOrPositionalExpression(): Expression {
		const left = parseAdditiveExpression()
		if (at().type == TokenType.RelationalOperator) {
			return parseRelationalExpression(left)
		} else if (at().type == TokenType.PositionalOperator || at().type == TokenType.Hyphen) {
			return parsePositionalExpression(left)
		} else if (at().type == TokenType.InOperator) {
			return parseInOperator(left)
		}
		return left
	}
	
	function parseRelationalExpression(left: Expression): RelationalOperation {
		if (!isArithmetic(left)) error('Left operand of relational expression must be arithmetic.', left)
		const operator = eat()
		const right = parseAdditiveExpression()
		if (!isArithmetic(right)) error('Right operand of relational expression must be arithmetic.', right)
		return {
			type: 'RelationalOperation',
			operands: [left, right],
			operator: operator.value,
			returns: 'logical',
			pos: [...operator.pos, operator.value.length],
			dollar: left.dollar || right.dollar,
		}
	}
	
	function parseInOperator(left: Expression): InOperator {
		if (!isArithmetic(left) && !isIdentifier(left)) error('Left operand of "in" must be arithmetic or identifier.', left)
		const token = eat() // eat 'in'
		const right = parsePrimaryExpression()
		if (!isSetLiteral(right) && !isRangeLiteral(right)) error('Right operand of "in" must be a set or range literal.', right)
		return {
			type: 'InOperator',
			operands: [left, right],
			operator: 'in',
			returns: 'logical',
			pos: [...token.pos, 2],
			dollar: left.dollar || right.dollar,
		}
	}
	
	function parsePositionalExpression(left: Expression): LogicalExpression {
		
		function getPart() {
			const token = eat()
			const op = token.value
			let dist: number | undefined = undefined
			if (at().type == TokenType.Number) {
				dist = parseInt(eat().value)
				const closeOperator = eat()
				if (
					closeOperator.value != op ||
					closeOperator.type != TokenType.PositionalOperator &&
					closeOperator.type != TokenType.Hyphen
				) {
					error('Mismatched positional operator.', closeOperator)
				}
			}
			const exp = parsePrimaryExpression()
			if (!isIdentifier(exp)) error('Right operand of positional expression must be an identifier.', exp)
			return { op, dist, exp, pos: token.pos }
		}
		
		function posOp(left: Identifier, right: Identifier, op: string, dist: number | undefined, pos: [number, number]): PositionalOperation {
			return {
				type: 'PositionalOperation',
				operands: [left, right],
				operator: op.replace(/_/g, '-'),
				distance: dist,
				returns: 'logical',
				pos,
				dollar: left.dollar || right.dollar,
			}
		}
		
		function mergeOp(po1?: PositionalOperation, po2?: PositionalOperation, pos?: [number, number]): PositionalOperation | LogicalBinaryOperation | undefined {
			if (!po1 && !po2) return undefined
			if (!po1) return po2!
			if (!po2) return po1
			return {
				type: 'LogicalBinaryOperation',
				operator: '&',
				returns: 'logical',
				operands: [po1, po2],
				pos,
				dollar: po1.dollar || po2.dollar,
			}
		}
		
		function flipOp(po: PositionalOperation | undefined): PositionalOperation | undefined {
			if (!po) return undefined
			return {
				...po,
				operands: [po.operands[1], po.operands[0]],
			}
		}
		
		function flipMerge(l1: LogicalExpression, l2: LogicalExpression | undefined, pos: [number, number]): LogicalExpression {
			if (!l2) return l1
			return {
				type: 'LogicalBinaryOperation',
				operator: '|',
				returns: 'logical',
				operands: [l1, l2],
				pos,
				dollar: l1.dollar || l2.dollar,
			} as LogicalBinaryOperation
		}
		
		if (!isIdentifier(left)) error('Left operand of positional expression must be an identifier.', left)
		
		const part1 = getPart()
		const part2 =
			at().type == TokenType.PositionalOperator ||
			at().type == TokenType.Hyphen ?
				getPart() : undefined
		if (part2 && part1.op.charAt(0) != part2.op.charAt(0)) {
			error('Mismatched positional operator.', part1, `(${part1.op} and ${part2.op})`)
		}
		
		const po1 = posOp(left, part1.exp, part1.op, part1.dist, part1.pos)
		const po2 = part2 ? posOp(part1.exp, part2.exp, part2.op, part2.dist, part2.pos) : undefined
		const po1f = part1.op.charAt(0) == '_' ? flipOp(po1) : undefined
		const po2f = part2?.op?.charAt(0) == '_' ? flipOp(po2) : undefined
		const po12 = mergeOp(po1, po2, part1.pos)!
		const po12f = mergeOp(po2f, po1f, part1.pos)
		
		return flipMerge(po12, po12f, part1.pos)
	}
	
	
	function parseAdditiveExpression(): Expression {
		let left = parseMultiplicativeExpression()
		if (!isArithmetic(left)) return left
		
		while (at().value == '+' || at().value == '-' || at().value == 'diff') {
			const operator = eat()
			const right = parseMultiplicativeExpression()
			if (!isArithmetic(right)) error('Right operand of arithmetic expression must be arithmetic.', right)
			left = {
				type: 'ArithmeticBinaryOperation',
				operands: [left, right],
				operator: operator.value,
				returns: 'arithmetic',
				pos: [...operator.pos, operator.value.length],
				dollar: left.dollar || right.dollar,
			} as ArithmeticBinaryOperation
		}
		
		return left
	}
	
	function parseMultiplicativeExpression(): Expression {
		let left = parsePrimaryExpression()
		if (!isArithmetic(left)) return left
		
		while (
			at().value == '/' ||
			at().value == '*' ||
			at().value == '%'
			) {
			const operator = eat()
			const right = parsePrimaryExpression()
			if (!isArithmetic(right)) error('Right operand of arithmetic expression must be arithmetic.', right)
			left = {
				type: 'ArithmeticBinaryOperation',
				operands: [left, right],
				operator: operator.value,
				returns: 'arithmetic',
				pos: [...operator.pos, operator.value.length],
				dollar: left.dollar || right.dollar,
			} as ArithmeticBinaryOperation
		}
		
		return left
	}
	
	function parsePrimaryExpression(): Expression {
		let token = eat()
		switch (token.type) {
			case TokenType.Identifier:
				const split = token.value.split(':')
				if (split.length == 1)
					return {
						type: 'Identifier',
						symbol: split[0],
						returns: 'other',
						pos: [...token.pos, token.value.length],
						dollar: split[0] == '$',
					} as Identifier
				if (split.length == 2)
					return {
						type: 'NumericIdentifier',
						symbol: split[0],
						category: split[1],
						returns: 'arithmetic',
						pos: [...token.pos, token.value.length],
						dollar: split[0] == '$',
					} as NumericIdentifier
				return error('Invalid identifier.', token)
			case TokenType.Number:
				return {
					type: 'NumericLiteral',
					value: parseInt(token.value),
					returns: 'arithmetic',
					pos: [...token.pos, token.value.length],
					dollar: false,
				} as NumericLiteral
			case TokenType.OpenParenthesis: {
				// token is the opening paren
				let values: Expression[] = []
				while (true) {
					values.push(parseExpression())
					if (at().type == TokenType.Comma) {
						eat()
					} else if (at().type == TokenType.CloseParenthesis) {
						eat()
						break
					} else {
						error('Unexpected token in parenthesised expression. Expected comma or closing parenthesis.', at())
					}
				}
				if (values.length == 1) return values[0]!
				return {
					type: 'SetLiteral',
					elements: values,
					returns: 'other',
					pos: token.pos,
					dollar: values.some(v => v.dollar),
				} as SetLiteral
			}
			case TokenType.OpenBracket: {
				// token is the opening bracket
				const start = parseExpression()
				if (!isArithmetic(start)) error('Range start must be arithmetic.', start)
				if (at().type != TokenType.Comma) error('Expected comma in range literal.', at())
				eat() // eat the comma
				const end = parseExpression()
				if (!isArithmetic(end)) error('Range end must be arithmetic.', end)
				if (at().type != TokenType.CloseBracket) error('Expected closing bracket in range literal.', at())
				eat() // eat the closing bracket
				return {
					type: 'RangeLiteral',
					start: start,
					end: end,
					returns: 'other',
					pos: token.pos,
					dollar: start.dollar || end.dollar,
				} as RangeLiteral
			}
			case TokenType.Truths:
				const set = parsePrimaryExpression()
				if (!isSetLiteral(set)) error('Truths operator must be applied to a set literal.', set)
				for (const elem of set.elements) {
					if (!isLogical(elem)) error('All elements of set in truths operator must be logical.', elem)
				}
				return {
					type: 'TruthsOperator',
					operator: 'truths',
					operands: [set],
					returns: 'arithmetic',
					pos: [...token.pos, token.value.length],
					dollar: set.elements.some(e => e.dollar),
				} as TruthsOperator
			default:
				error('Unexpected token found during parsing.', token)
		}
	}
}

/**
 * Parses the header section of tokens to extract options and categories.
 * @param tokens - The list of tokens representing the header.
 * @returns An object containing the parsed options, great categories, and remaining tokens.
 */
export function parseHeader(tokens: Token[]) {
	const options: Record<string, string[]> = {}
	const greatCategories: string[] = []
	let category = ''
	let vals: string[] = []
	while (tokens[0]?.type != TokenType.EOF && tokens[0]?.type != TokenType.ConfigDelimiter) {
		const v = tokens.shift()!
		if (v.type == TokenType.Identifier || v.type == TokenType.Number) {
			if (tokens[0]?.type == TokenType.Hyphen || tokens[0]?.value == '*') {
				if (category != '') options[category] = structuredClone(vals)
				category = v.value
				vals = []
				if (tokens[0]?.type == TokenType.Hyphen)
					tokens.shift() // eat hyphen
			} else {
				vals.push(v.value)
			}
		} else if (v.type == TokenType.ArithmeticOperator) {
			if (v.value != '*') continue
			if (vals.length > 0) continue
			greatCategories.push(category)
		}
	}
	options[category] = vals
	tokens.shift()
	return {
		options,
		greatCategories,
		tokens,
	}
}