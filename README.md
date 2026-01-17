# Zebra solver

## Installation

You can install the zebra solver library via your preferred package manager. For example, using npm:

```bash
npm install zebra-solver
```

For solving using the command line interface (CLI) without installing, you can execute it directly using:

```bash
npx zebra-solver [path to puzzle] [iterations, default: 50]
```
So for example, to solve a puzzle located at `path/to/puzzle.zbc` with a maximum of 10 iterations, you would run:
```bash
npx zebra-solver path/to/puzzle.zbc 10
```
Or you can leave out the iterations to use the default value of 50:
```bash
npx zebra-solver path/to/puzzle.zbc
```

## Library

You need to import functions or types from the library:

```typescript
import { /*...*/ } from 'zebra-solver'
```
### Functions
#### solvePuzzle(input: string, iterations?: number): Solved

Solves a zebra puzzle from a string in ZBC format.

Arguments:
- `input` - The puzzle in ZBC format.
- `iterations` - Optional maximum number of iterations to perform (default: `50`).

#### iterativeSolver(input: string): ((iterations: number) => Solved)

Creates an iterative solver function for the given puzzle input.

Arguments:
- `input` - The puzzle in ZBC format.


## ZBC file format

The ZBC file format is a text-based format used to define headers and clues for a zebra puzzle. It consists of two main
sections: `HEADER` and `CLUES`. The header section is at the top part, then there is a separator line with three
dashes (`---`), followed by the clues section. Indentation and blank lines are ignored.

### Comments

Everything between double quotes (`"`) is treated as a comment and ignored. There can be multiple lines between the
quotes. Comments work in both sections.

Example:

```
This is a code
"This is a comment
that spans multiple lines"
This is more code
```

### HEADER section

The `HEADER` section defines the categories and their possible values. Each value need to be unique and be made of
alphanumeric characters.

Each category is defined as: `CATEGORY_NAME - VALUE1 VALUE2 VALUE3 ...`. Important is:

- There is a dash (`-`) between the category name and the values.
- Values are separated by a space, comma, tabulator, new line or some combination of those (so multiple spaces and a
  comma is fine).
- Category names and values are case-sensitive.
- All strings need to be alphanumeric (`A-Z`, `a-z`, `0-9` and diacritics) and unique.

Great categories are used, when we want to define more category items than there are positions. That means that not all
items from that category will be assigned to a house. Remember that:

- Great categories are marked with an asterisk (`*`) after the category name.
- Great categories mustn't have fewer items than there are positions.
- There must be at least one non-great category.
- Each item from a great category can only be assigned to at most one position.

Example:

```
Name - Alice Bob Charlie David Eve
Color* - Red Green Blue Yellow White Orange Purple Gray Black
Drink - Tea, Coffee, Milk, Juice, Water
Pet - Dog   Cat   Bird   Fish   Hamster
```

### Identifiers

To use identifiers in clues, you can use one of the following formats:

- `item`
- `category.item`
    - This format is compulsory when two categories have items with the same name.
    - This format is compulsory for accessing items that are only numeric (e.g., `age.20`).

#### Identifiers for positions

Positions are represented using `#` followed by the position number (starting from 1). For example, `#1` is the first
position, `#2` is the second position, and so on.

You can also use `#` as the position number for working with arithmetic clues. For example, `David:#` represents the
numeric value of David's position.

### Numeric values

When you use arithmetic clues, you don't want to work with items, but with their numeric values. To access the numeric
value of an item, you can use one of the following formats:

- `num` (e.g. `10`) - A literal number.
- `category.item` (e.g. `age.20`) - The numeric value of the item.
- `item:category` (e.g. `Bob:age`) - Get the numeric value of an attribute in the same position as the item.
    - This format is useful when you want to compare numeric values of items from different categories.

### Positional clues

These clues define the relative positions of items.

Possible positional clues are:

- Same position: `A = B` (A and B are in the same position)
- Immediately left of: `A - B` (A is immediately to the left of B)
- Somewhere left of: `A -- B` (A is somewhere to the left of B
- Exactly k places left of: `A -k- B` (A is exactly k places to the left of B)
- Adjacent (undirected): `A _ B` (A is next to B in any order)
- Not the same position: `A __ B` (A is some places away from B, but not the same)
- Distance k apart (undirected): `A _k_ B` (A is k places away from B in any order)

If an item is between two others, it can be defined in a shorter way: `A [arg1] B [arg2] C` which means that B is
between A and C. Remember:

- `arg1` and `arg2` can be any of the above positional clues except for `=`.
- You cannot combine directed and undirected clues in this way. So either both `arg1` and `arg2` are directed clues, or
  both are undirected clues.
- You can combine adjacency with distance, e.g., `A _ B _2_ C` means that B is adjacent to A and two places away from C.
- When using undirected clues, the order is either A B C or C B A.
- You cannot combine more than three items in this way.

### Logical clues

These clues define logical relations between truthfulness of other clues. Logical operators can be unary, binary or
set-based. The expression need to be logical and the operator will check the validity of the expression.

Possible logical expressions are:

- Positional clues (see "Positional clues" section above)
- Comparisons of arithmetic expressions (see "Arithmetic clues" section below)
- More complex logical expressions enclosed in parentheses

#### Conjunction (and)

Sign: `&`  
Type: Binary, Set-based  
Meaning: All listed expressions are true.

#### Disjunction (or)

Sign: `|`  
Type: Binary, Set-based  
Meaning: At least one of the listed expressions is true.

#### Exclusive Or (xor)

Sign: `^`  
Type: Binary  
Meaning: Exactly one of the two expressions is true.

#### Equivalence

Sign: `<=>  
Type: Binary  
Meaning: Both expressions are true or both expressions are false.

#### Negation

Sign: `!`  
Type: Unary  
Meaning: The following expression is false.

#### Implication

Sign: `=>`  
Type: Binary  
Meaning: If the first expression is true, then the second expression is also true. If the first expression is false, the
second expression can be whatever.

#### Unary operators

Unary operators apply to a single expression. The only unary operator is negation (`!`). The syntax is:
```!EXPRESSION```
The expression can be a clue or something more complex enclosed in parentheses.

#### Binary operators

Binary operators apply to two expressions. The syntax is:
```EXPRESSION1 OPERATOR EXPRESSION2```
The expressions can be clues or something more complex enclosed in parentheses.

#### Set-based operators

Set-based operators apply to multiple expressions. The syntax is:
```OPERATOR(EXPRESSION1, EXPRESSION2, EXPRESSION3, ...)```
The expressions can be clues or something more complex enclosed in parentheses. Expressions are separated by commas
because the parentheses act as a set.
> Important: The set-based operator has to be doubled: `&&(...)` or `||(...)`.

### Arithmetic clues

These clues are made of comparing two arithmetic expressions.

Possible arithmetic expressions are:

- A numeric value (see "Numeric values" section above)
- An arithmetic operation

#### Arithmetic operations

Possible arithmetic operations are:

- Addition: `+`
- Subtraction: `-`
- Multiplication: `*`
- Division: `/`
- Parentheses: `(...)`
- Modulo: `%`
- Absolute difference: `diff`

Each operation takes two arguments, except for parentheses which take one argument. The syntax is:
```EXPRESSION1 OPERATION EXPRESSION2```
The expression can be a numeric value or any other arithmetic operation. The evaluation follows the standard order of
operations (parentheses, multiplication/division/modulo, addition/subtraction).

#### Comparison operators

Possible comparison operators are:

- Equal to: `==`
- Greater than: `>`
- Less than: `<`
- Greater than or equal to: `>=`
- Less than or equal to: `<=`

The syntax is:
```EXPRESSION1 COMPARISON_OPERATOR EXPRESSION2```
The expressions is an arithmetic expressions as defined above.

### Sets and ranges

Difference between sets and ranges:

- Set is a collection of values enclosed in parentheses and separated by commas. The values can be identifiers or
  numeric values.
- Range is defined using square brackets with two numeric values separated by a comma, representing an inclusive range.

For working with sets and ranges, use the `in` operator to check if a value belongs to a set or range.

#### Usage

The syntax for using sets and ranges is:
```VALUE in SET_OR_RANGE```
The `VALUE` can be an identifier or an arithmetic expression. The `SET_OR_RANGE` can be a set or a range.

### Dynamic item

Dynamic item is a variable that represent a position. It will generate a set of clues for each possible position.
Dynamic item is represented using `$`.

#### Examples

Everybody has the same or higher age than the second person:

```
$:age >= #2:age
```

Everybody to the left of Alice has favourite number less than 10:

```
$ -- Alice => $:favouriteNumber < 10
```

Everyone's age is ten times their position:

```
$:age == $:# * 10
```

### Special functions

Now, there is only one special function implemented: the `truths` function.

#### Truths function

The `truths` function counts how many of its arguments are true. It can be used in arithmetic expressions. The arguments
have to be logical expressions.
The syntax is:
```truths(EXPRESSION1, EXPRESSION2, EXPRESSION3, ...)```

Example: *Exactly two of the three expressions are true.*

```
truths(A _ B, C = D, E -- F) == 2
```
