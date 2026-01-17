export type NodeType =
	| 'Clues'
	| 'Identifier'
	| 'NumericLiteral'
	| 'NumericIdentifier'
	| 'SetLiteral'
	| 'RangeLiteral'
	| 'ArithmeticBinaryOperation'
	| 'LogicalUnaryOperation'
	| 'LogicalBinaryOperation'
	| 'LogicalOperation'
	| 'RelationalOperation'
	| 'PositionalOperation'
	| 'InOperator'
	| 'TruthsOperator'

export interface Expression {
	type: NodeType
	returns: 'arithmetic' | 'logical' | 'other'
	pos: [number, number, number?] // start, end, length?
	dollar: boolean
	solved?: boolean
	states?: Record<string, any>
}

export interface Clues extends Expression {
	type: 'Clues'
	body: LogicalExpression[]
	returns: 'other'
}

export interface ArithmeticExpression extends Expression {
	returns: 'arithmetic'
}

export interface LogicalExpression extends Expression, Operation {
	returns: 'logical'
}

export interface Operation extends Expression {
	operator: string
	operands: Expression[]
}

export interface ArithmeticBinaryOperation extends Operation, ArithmeticExpression {
	type: 'ArithmeticBinaryOperation'
	operands: [ArithmeticExpression, ArithmeticExpression]
	returns: 'arithmetic'
}

export interface LogicalUnaryOperation extends Operation, LogicalExpression {
	type: 'LogicalUnaryOperation'
	operands: [LogicalExpression]
	returns: 'logical'
}

export interface LogicalBinaryOperation extends Operation, LogicalExpression {
	type: 'LogicalBinaryOperation'
	operands: [LogicalExpression, LogicalExpression]
	returns: 'logical'
}

export interface LogicalOperation extends Operation, LogicalExpression {
	type: 'LogicalOperation'
	operands: LogicalExpression[]
	returns: 'logical'
}

export interface RelationalOperation extends Operation, LogicalExpression {
	type: 'RelationalOperation'
	operands: [ArithmeticExpression, ArithmeticExpression]
	returns: 'logical'
}

export interface PositionalOperation extends Operation, LogicalExpression {
	type: 'PositionalOperation'
	operands: [Identifier, Identifier]
	distance?: number
	returns: 'logical'
}

export interface InOperator extends Operation, LogicalExpression {
	type: 'InOperator'
	operands: [ArithmeticExpression | Identifier, SetLiteral | RangeLiteral]
	returns: 'logical'
}

export interface TruthsOperator extends Operation, ArithmeticExpression {
	type: 'TruthsOperator'
	operands: [SetLiteral]
	returns: 'arithmetic'
}

export interface Identifier extends Expression {
	type: 'Identifier'
	symbol: string
}

export interface NumericLiteral extends ArithmeticExpression {
	type: 'NumericLiteral'
	value: number
}

export interface NumericIdentifier extends ArithmeticExpression {
	type: 'NumericIdentifier'
	symbol: string
	category: string
}

export interface SetLiteral extends Expression {
	type: 'SetLiteral'
	elements: Expression[]
}

export interface RangeLiteral extends Expression {
	type: 'RangeLiteral'
	start: ArithmeticExpression
	end: ArithmeticExpression
}