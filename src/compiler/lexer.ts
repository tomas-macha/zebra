import { CompilerError } from './compiler.ts'

export enum TokenType {
	Identifier,
	Number,
	LogicalOperator,
	RelationalOperator,
	PositionalOperator,
	ArithmeticOperator,
	OpenParenthesis,
	CloseParenthesis,
	OpenBracket,
	CloseBracket,
	Comma,
	EOF,
	Hyphen,
	Truths,
	InOperator,
	ConfigDelimiter,
}

const ONE_CHAR_TOKENS: Record<string, TokenType> = {
	'(': TokenType.OpenParenthesis,
	')': TokenType.CloseParenthesis,
	'[': TokenType.OpenBracket,
	']': TokenType.CloseBracket,
	',': TokenType.Comma,
	'+': TokenType.ArithmeticOperator,
	'*': TokenType.ArithmeticOperator,
	'/': TokenType.ArithmeticOperator,
	'%': TokenType.ArithmeticOperator,
}

const KEYWORDS: Record<string, TokenType> = {
	diff: TokenType.ArithmeticOperator,
	truths: TokenType.Truths,
	in: TokenType.InOperator,
}

const LOGICAL_OPERATORS = ['!', '&', '|', '&&', '||', '^', '=>', '<=>']
const RELATIONAL_OPERATORS = ['==', '>', '<', '>=', '<=', '!=']
const POSITIONAL_OPERATORS = ['=', '--', '__', '_']
const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%']


export type Token = {
	type: TokenType
	value: string
	pos: [number, number]
}

export const isDigit = (char: string) => /\d/.test(char)
export const canBeIdentifier = (char: string) => /\p{L}\p{M}*|[0-9#.:$]/u.test(char)
export const isSkippable = (char: string) => /\s/.test(char)

/**
 * Tokenizes the given input string into an array of tokens.
 * @param input The clues input in zbc format.
 */
export function tokenize(input: string): Token[] {
	const tokens: Token[] = []
	const src = input.split('')
	let pos: [number, number] = [1, 0]
	
	function token(t: TokenType, v: string) {
		tokens.push({ type: t, value: v, pos: structuredClone(pos) })
	}
	
	while (src.length > 0) {
		if (!src[0]) continue
		if (src[0] === '\n') {
			pos[0]++
			pos[1] = 0
			src.shift()
			continue
		}
		pos[1]++
		if (src[0] == '"') {
			src.shift()
			while (src.length > 0 && src[0] != '"') {
				if (src[0] == '\n') {
					pos[0]++
					pos[1] = 0
				} else {
					pos[1]++
				}
				src.shift()
			}
			pos[1]++
			src.shift()
			continue
		}
		const type = charType(src[0])
		if (type == 'skippable') {
			src.shift()
		} else if (type == 'one-char') {
			const t = src.shift()!
			token(ONE_CHAR_TOKENS[t]!, t)
		} else if (type == 'digit') {
			let num = ''
			while (src.length > 0 && isDigit(src[0])) {
				num += src.shift()
			}
			token(TokenType.Number, num)
			pos[1] += num.length - 1
		} else if (type == 'alpha') {
			let id = ''
			while (src.length > 0 && (canBeIdentifier(src[0]) || isDigit(src[0]))) {
				id += src.shift()
			}
			if (id in KEYWORDS) {
				token(KEYWORDS[id]!, id)
			} else {
				token(TokenType.Identifier, id)
			}
			pos[1] += id.length - 1
		} else {
			let t = ''
			while (src.length > 0 && charType(src[0]) == 'unknown') {
				t += src.shift()
			}
			if (LOGICAL_OPERATORS.includes(t)) {
				token(TokenType.LogicalOperator, t)
			} else if (RELATIONAL_OPERATORS.includes(t)) {
				token(TokenType.RelationalOperator, t)
			} else if (POSITIONAL_OPERATORS.includes(t)) {
				token(TokenType.PositionalOperator, t)
			} else if (t == '-') {
				token(TokenType.Hyphen, t)
			} else if (t == '---') {
				token(TokenType.ConfigDelimiter, t)
			} else if (ARITHMETIC_OPERATORS.includes(t)) {
				token(TokenType.ArithmeticOperator, t)
			} else {
				throw new CompilerError(`Unrecognized token.`, pos, t)
			}
			pos[1] += t.length - 1
		}
	}
	tokens.push({ type: TokenType.EOF, value: 'EOF', pos })
	return tokens
}

function charType(c: string): 'one-char' | 'skippable' | 'digit' | 'alpha' | 'unknown' {
	if (c in ONE_CHAR_TOKENS) return 'one-char'
	if (isSkippable(c)) return 'skippable'
	if (isDigit(c)) return 'digit'
	if (canBeIdentifier(c)) return 'alpha'
	return 'unknown'
}
