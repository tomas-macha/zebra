import { parse, parseHeader } from './parser.ts'
import { tokenize } from './lexer.ts'

/**
 * Compiles the given zbc code.
 * @param code The zbc code as a string.
 * @returns The compiled clues, categories and items.
 */
export function compile(code: string) {
	const tokens = tokenize(code)
	const header = parseHeader(tokens)
	const clues = parse(header.tokens)
	
	return {
		clues,
		categories: header.options,
		greatCategories: header.greatCategories,
	}
}


export class CompilerError extends Error {
	/** The position [line, column] where the error occurred. */
	public readonly position: [number, number]
	/** Additional detail about the error. */
	public readonly detail: any
	
	/**
	 * Creates a new CompilerError.
	 * @param message The error message.
	 * @param position The position [line, column] where the error occurred.
	 * @param detail Additional detail about the error.
	 */
	constructor(message: string, position: [number, number], detail?: any) {
		const d = detail ? ' '+(
			typeof detail === 'object' ? JSON.stringify(detail) : detail.toString()
		) : ''
		super(`Error at [${position.join(':')}]: ${message}${d}`)
		this.position = position
		this.detail = detail
	}
}