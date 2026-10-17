import type { ErrorContext, PyErrorInfo } from '@/types/engine';

export type ErrorCategory = 'syntax' | 'runtime' | 'logic' | 'limit' | 'environment';

export interface HumanizedError {
  /** Short, friendly headline, e.g. "That list isn't that long". */
  title: string;
  /** Plain-English explanation of what happened. */
  explanation: string;
  /** Actionable next step. */
  hint?: string;
  category: ErrorCategory;
  errorType: string;
  line: number | null;
  /** Raw Python message, available behind a "Show technical details" toggle. */
  technical: string;
  /** Cheat-sheet entry id to deep link to. */
  docRef?: string;
}

type Built = Pick<HumanizedError, 'title' | 'explanation'> & Partial<Pick<HumanizedError, 'hint' | 'docRef' | 'category'>>;

interface Rule {
  types: string[];
  pattern?: RegExp;
  build: (m: RegExpMatchArray | null, err: PyErrorInfo, ctx: ErrorContext, codeLine: string | null) => Built;
}

// ── helpers ──────────────────────────────────────────────────────────────────
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const code = (s: string) => `\`${s}\``;

const SYNTAX_TYPES = ['SyntaxError', 'IndentationError', 'TabError'];

// ── rules (first match wins; order from most to least specific) ─────────────
const RULES: Rule[] = [
  // ─── PyPath sandbox pseudo-errors ───
  {
    types: ['PyPathTimeout'],
    build: () => ({
      category: 'limit',
      title: 'Your program ran for too long',
      explanation:
        "PyPath stopped your code because it didn't finish in time. This almost always means a loop that never ends — like a `while` loop whose condition never becomes `False`.",
      hint: 'Check that something inside your loop changes the condition (e.g. `count += 1`), or add a `break`.',
      docRef: 'while-loop',
    }),
  },
  {
    types: ['PyPathOutputLimit'],
    build: () => ({
      category: 'limit',
      title: 'Whoa, that is a lot of output',
      explanation: 'Your program printed so much text that PyPath had to cut it off. This usually means a `print` inside a loop that runs far more times than you expected.',
      hint: 'Print fewer items (e.g. `print(items[:10])`) or check your loop’s range.',
    }),
  },
  {
    types: ['PackageUnavailableError'],
    build: () => ({
      category: 'environment',
      title: "That library isn't installed offline",
      explanation: 'This lesson needs a Python package that is not bundled for offline use on your device.',
      hint: 'Connect to the internet once and run again — PyPath will cache it for next time.',
    }),
  },
  {
    types: ['EngineCrash', 'EngineError', 'EngineUnavailable', 'SandboxSetupError', 'TestDefinitionError'],
    build: (_m, err) => ({
      category: 'environment',
      title: 'Something went wrong on our side',
      explanation: err.message,
      hint: 'Try running again. If it keeps happening, restart the Python engine from Settings.',
    }),
  },

  // ─── Syntax & indentation ───
  {
    types: ['IndentationError'],
    pattern: /expected an indented block after '(\w+)' statement on line (\d+)/,
    build: (m) => ({
      title: 'This block needs to be indented',
      explanation: `Line ${m?.[2]} starts an ${code(m?.[1] ?? 'if')} block (it ends with ${code(':')}), so the next line must be indented to show what belongs inside it.`,
      hint: 'Tap the ⇥ key on the accessory bar to indent by 4 spaces.',
      docRef: 'indentation',
    }),
  },
  {
    types: ['IndentationError'],
    pattern: /unexpected indent/,
    build: () => ({
      title: 'Unexpected indentation',
      explanation: 'This line is indented, but it isn’t inside an `if`, `for`, `while`, `def` or other block. In Python, indentation has meaning — it is not just decoration.',
      hint: 'Remove the spaces at the start of the line (⇤ key).',
      docRef: 'indentation',
    }),
  },
  {
    types: ['IndentationError', 'TabError'],
    pattern: /unindent does not match|inconsistent use of tabs/,
    build: () => ({
      title: 'Indentation levels don’t line up',
      explanation: 'This line’s indentation doesn’t match any block above it. Every line in the same block must start at exactly the same column.',
      hint: 'Use 4 spaces per level and line this up with the block it belongs to.',
      docRef: 'indentation',
    }),
  },
  {
    types: ['SyntaxError'],
    pattern: /'(\(|\[|\{)' was never closed/,
    build: (m) => {
      const close = { '(': ')', '[': ']', '{': '}' }[m?.[1] as '(' | '[' | '{'];
      return {
        title: `Missing a closing ${code(close)}`,
        explanation: `You opened a ${code(m?.[1] ?? '(')} but never closed it. Python reached the end of your code still waiting for the matching ${code(close)}.`,
        hint: 'Use the () [] {} keys — they insert both brackets at once.',
      };
    },
  },
  {
    types: ['SyntaxError'],
    pattern: /expected ':'/,
    build: () => ({
      title: 'Missing a colon',
      explanation: 'Lines that start a block — `if`, `elif`, `else`, `for`, `while`, `def`, `class` — must end with a colon `:`.',
      hint: 'Add `:` at the end of the highlighted line.',
      docRef: 'if-statement',
    }),
  },
  {
    types: ['SyntaxError'],
    pattern: /unterminated (triple-quoted )?string literal/,
    build: () => ({
      title: 'A string was never closed',
      explanation: 'You started some text with a quote mark but didn’t finish it with a matching quote on the same line.',
      hint: 'Make sure every `"` or `\'` has a partner.',
      docRef: 'strings',
    }),
  },
  {
    types: ['SyntaxError'],
    pattern: /Maybe you meant '==' or ':=' instead of '='/,
    build: () => ({
      title: '= vs ==',
      explanation: 'A single `=` *stores* a value in a variable. To *compare* two values inside a condition, use a double `==`.',
      hint: 'Change `=` to `==` in your condition.',
      docRef: 'comparison-operators',
    }),
  },
  {
    types: ['SyntaxError'],
    pattern: /Perhaps you forgot a comma/,
    build: () => ({
      title: 'Looks like a missing comma',
      explanation: 'Python found two values side by side with nothing between them. Items in a list, tuple, or function call must be separated by commas.',
      hint: 'Add a `,` between the items.',
    }),
  },
  {
    types: ['SyntaxError'],
    pattern: /cannot assign to (function call|literal|expression)/,
    build: (m) => ({
      title: 'You can’t assign to that',
      explanation: `The left side of ${code('=')} must be a variable name, but here it is a ${m?.[1]}. Values flow right-to-left: ${code('name = value')}.`,
      hint: 'If you meant to compare, use `==`.',
    }),
  },
  {
    types: ['SyntaxError'],
    pattern: /invalid character '(.)'/,
    build: (m) => ({
      title: 'A character Python doesn’t understand',
      explanation: `The character ${code(m?.[1] ?? '?')} isn’t valid Python. This often comes from copy-pasting “smart quotes” or long dashes.`,
      hint: 'Retype the quotes or symbols using the accessory bar keys.',
    }),
  },
  {
    types: ['SyntaxError'],
    pattern: /'return' outside function/,
    build: () => ({
      title: '`return` outside a function',
      explanation: '`return` sends a value back from a function, so it can only be used inside a `def` block.',
      hint: 'Indent this line under your function, or use `print()` instead.',
      docRef: 'functions',
    }),
  },
  {
    types: SYNTAX_TYPES,
    build: (_m, err) => ({
      title: 'Python couldn’t read this line',
      explanation: `There’s a typo in your code’s grammar, so Python couldn’t understand it (${err.message}). Nothing ran yet — Python checks the whole file first.`,
      hint: 'Look closely at the highlighted line and the one just above it for missing brackets, quotes, colons, or commas.',
    }),
  },

  // ─── Lookup errors ───
  {
    types: ['IndexError'],
    pattern: /index out of range/,
    build: (_m, _err, ctx) => {
      if (ctx.index != null && ctx.length != null) {
        const kind = ctx.container ?? 'list';
        const target = code(ctx.target ?? kind);
        if (ctx.length === 0) {
          return {
            title: `${target} is empty`,
            explanation: `You tried to read item ${code(String(ctx.index))} of ${target}, but the ${kind} has no items at all.`,
            hint: `Check ${code(`if ${ctx.target ?? kind}:`)} before reading from it.`,
            docRef: 'lists',
          };
        }
        const position = ctx.index >= 0 ? `the ${ordinal(ctx.index + 1)} item` : `the ${ordinal(-ctx.index)} item from the end`;
        return {
          title: `That ${kind} isn’t that long`,
          explanation: `You tried to access ${position} of ${target} (index ${ctx.index}), but the ${kind} only has ${plural(ctx.length, 'item')}!`,
          hint: `Python counts from 0, so valid indexes are 0 to ${ctx.length - 1}. Use ${code(`${ctx.target ?? kind}[-1]`)} for the last item, or loop with ${code(`range(len(${ctx.target ?? kind}))`)}.`,
          docRef: 'lists',
        };
      }
      return {
        title: 'Index out of range',
        explanation: 'You asked for a position that doesn’t exist in the list or string. Python counts from 0, so a list of 4 items has positions 0, 1, 2 and 3.',
        hint: 'Print `len(...)` of your list to check its size.',
        docRef: 'lists',
      };
    },
  },
  {
    types: ['IndexError'],
    pattern: /pop from empty list/,
    build: () => ({
      title: 'Nothing left to pop',
      explanation: '`.pop()` removes an item from a list, but the list was already empty.',
      hint: 'Check `if my_list:` before popping.',
      docRef: 'lists',
    }),
  },
  {
    types: ['KeyError'],
    build: (_m, err, ctx) => {
      const key = ctx.key ?? err.message;
      const target = ctx.target ? code(ctx.target) : 'the dictionary';
      const keys = ctx.availableKeys?.length ? ` It currently has: ${ctx.availableKeys.join(', ')}.` : '';
      return {
        title: `No key ${key} found`,
        explanation: `You looked up ${code(key)} in ${target}, but that key doesn’t exist.${keys}`,
        hint: ctx.suggestion
          ? `Did you mean ${code(ctx.suggestion)}? Keys are case-sensitive.`
          : `Use ${code(`.get(${key})`)} to return \`None\` instead of crashing, or check with ${code(`${key} in ${ctx.target ?? 'my_dict'}`)}.`,
        docRef: 'dictionaries',
      };
    },
  },

  // ─── Names & attributes ───
  {
    types: ['UnboundLocalError'],
    pattern: /local variable '(\w+)'/,
    build: (m) => ({
      title: `${code(m?.[1] ?? 'variable')} is used before it’s set`,
      explanation: `Inside this function, ${code(m?.[1] ?? '')} is assigned somewhere, which makes it a *local* variable — but you tried to read it before that assignment happened.`,
      hint: 'Pass the value in as a parameter, or set it before reading it.',
      docRef: 'scope',
    }),
  },
  {
    types: ['NameError'],
    pattern: /name '(\w+)' is not defined/,
    build: (m, _err, ctx) => {
      const name = m?.[1] ?? 'name';
      const looksLikeText = /^[A-Za-z]+$/.test(name) && !ctx.suggestion;
      return {
        title: `Python doesn’t know ${code(name)}`,
        explanation: `You used ${code(name)}, but no variable or function with that name exists at this point in the program.`,
        hint: ctx.suggestion
          ? `Did you mean ${code(ctx.suggestion)}? Names are case-sensitive.`
          : looksLikeText
            ? `If you meant the text "${name}", wrap it in quotes: ${code(`"${name}"`)}. Otherwise, make sure it’s defined *above* this line.`
            : 'Make sure it’s spelled correctly and defined above this line.',
        docRef: 'variables',
      };
    },
  },
  {
    types: ['AttributeError'],
    pattern: /'NoneType' object has no attribute '(\w+)'/,
    build: (m) => ({
      title: 'This value is None',
      explanation: `You tried to use ${code(`.${m?.[1]}`)} on something that is ${code('None')} (nothing). Usually a function forgot to ${code('return')} a value, or a method like ${code('.sort()')} changed a list in place and returned None.`,
      hint: 'Print the value just before this line to see what it really is.',
      docRef: 'none',
    }),
  },
  {
    types: ['AttributeError'],
    pattern: /'(\w+)' object has no attribute '(\w+)'/,
    build: (m, _err, ctx) => ({
      title: `${code(m?.[1] ?? 'object')} has no ${code(m?.[2] ?? '')}`,
      explanation: `Values of type ${code(m?.[1] ?? '')} don’t have anything called ${code(m?.[2] ?? '')}.`,
      hint: ctx.suggestion ? `Did you mean ${code(`.${ctx.suggestion}`)}?` : `Use ${code(`dir(value)`)} to list what is available.`,
    }),
  },

  // ─── Types ───
  {
    types: ['TypeError'],
    pattern: /can only concatenate str \(not "(\w+)"\) to str/,
    build: (m) => ({
      title: 'Mixing text and numbers',
      explanation: `You tried to join text with a ${code(m?.[1] ?? 'number')} using ${code('+')}. Python won’t guess whether you want maths or text.`,
      hint: `Convert with ${code('str(...)')}, or use an f-string: ${code('f"Total: {total}"')}.`,
      docRef: 'f-strings',
    }),
  },
  {
    types: ['TypeError'],
    pattern: /unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/,
    build: (m) => ({
      title: `Can’t use ${code(m?.[1] ?? '')} on these types`,
      explanation: `The ${code(m?.[1] ?? '')} operator doesn’t work between a ${code(m?.[2] ?? '')} and a ${code(m?.[3] ?? '')}.${m?.[2] === 'str' || m?.[3] === 'str' ? ' Remember: `input()` always gives you text, even if the user types a number.' : ''}`,
      hint: m?.[2] === 'NoneType' || m?.[3] === 'NoneType' ? 'One value is None — did a function forget to `return`?' : 'Convert one side with `int()`, `float()` or `str()`.',
      docRef: 'type-conversion',
    }),
  },
  {
    types: ['TypeError'],
    pattern: /'(\w+)' object is not subscriptable/,
    build: (m) => ({
      title: `You can’t use [ ] on a ${code(m?.[1] ?? '')}`,
      explanation: `Square brackets read items from lists, strings, and dictionaries — but this value is a ${code(m?.[1] ?? '')}.`,
      hint: m?.[1] === 'NoneType' ? 'The value is None — check the function that produced it returns something.' : 'Print the value and its `type()` to see what you actually have.',
    }),
  },
  {
    types: ['TypeError'],
    pattern: /'(\w+)' object is not callable/,
    build: (m) => ({
      title: `A ${code(m?.[1] ?? '')} isn’t a function`,
      explanation: `You put ${code('( )')} after something that is a ${code(m?.[1] ?? '')}, not a function. A common cause is naming a variable the same as a built-in, like ${code('list = [1, 2]')} or ${code('print = 5')}.`,
      hint: 'Rename the variable so it doesn’t shadow the function.',
    }),
  },
  {
    types: ['TypeError'],
    pattern: /'(\w+)' object is not iterable/,
    build: (m) => ({
      title: `Can’t loop over a ${code(m?.[1] ?? '')}`,
      explanation: `${code('for')} loops need a collection (list, string, range, dict…), but you gave it a ${code(m?.[1] ?? '')}.`,
      hint: m?.[1] === 'int' ? 'To repeat N times, use `for i in range(n):`.' : 'Check what the value actually is with `print(type(x))`.',
      docRef: 'for-loop',
    }),
  },
  {
    types: ['TypeError'],
    pattern: /(\w+)\(\) missing (\d+) required positional arguments?: (.+)/,
    build: (m) => ({
      title: `${code(`${m?.[1]}()`)} needs more information`,
      explanation: `${code(`${m?.[1]}()`)} expects ${m?.[3]}, but you didn’t pass ${Number(m?.[2]) === 1 ? 'it' : 'them'}.`,
      hint: 'Compare your call with the `def` line: each parameter needs a value.',
      docRef: 'functions',
    }),
  },
  {
    types: ['TypeError'],
    pattern: /(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/,
    build: (m) => ({
      title: 'Too many arguments',
      explanation: `${code(`${m?.[1]}()`)} accepts ${m?.[2]} argument(s), but received ${m?.[3]}.${Number(m?.[3]) === Number(m?.[2]) + 1 ? ' If this is a method in a class, did you forget `self` as the first parameter?' : ''}`,
      hint: 'Compare your call with the function definition.',
      docRef: 'functions',
    }),
  },
  {
    types: ['TypeError'],
    pattern: /'str' object does not support item assignment/,
    build: () => ({
      title: 'Strings can’t be changed in place',
      explanation: 'Strings are *immutable*: once created, their characters can’t be replaced one by one.',
      hint: 'Build a new string instead, e.g. `word = word[:0] + "J" + word[1:]` or use `.replace()`.',
      docRef: 'strings',
    }),
  },

  // ─── Values ───
  {
    types: ['ValueError'],
    pattern: /invalid literal for int\(\) with base 10: (.+)/,
    build: (m) => ({
      title: 'That text isn’t a whole number',
      explanation: `${code('int()')} can only convert text that looks like a whole number, but it got ${m?.[1]}.`,
      hint: 'For decimals use `float()`. Use `.strip()` to remove stray spaces.',
      docRef: 'type-conversion',
    }),
  },
  {
    types: ['ValueError'],
    pattern: /could not convert string to float: (.+)/,
    build: (m) => ({
      title: 'That text isn’t a number',
      explanation: `${code('float()')} couldn’t turn ${m?.[1]} into a number.`,
      hint: 'Remove symbols like `$` or `,` first: `float(text.replace(",", ""))`.',
      docRef: 'type-conversion',
    }),
  },
  {
    types: ['ValueError'],
    pattern: /(too many|not enough) values to unpack \(expected (\d+)(?:, got (\d+))?\)/,
    build: (m) => ({
      title: 'Unpacking count mismatch',
      explanation: `You’re unpacking into ${m?.[2]} variable(s), but the value has ${m?.[1] === 'too many' ? 'more' : 'fewer'} items${m?.[3] ? ` (${m[3]})` : ''}.`,
      hint: 'Make the number of names on the left match the number of items.',
    }),
  },
  {
    types: ['ZeroDivisionError'],
    build: () => ({
      title: 'Division by zero',
      explanation: 'You divided a number by zero, which has no answer in maths — so Python stops.',
      hint: 'Check the divisor first: `if count != 0:` (or `if count:`).',
    }),
  },

  // ─── Environment / misc ───
  {
    types: ['EOFError'],
    build: () => ({
      category: 'environment',
      title: 'Your program asked for input that never came',
      explanation: '`input()` was called, but no input was provided for this run.',
      hint: 'Make sure you call `input()` exactly as many times as the challenge describes.',
      docRef: 'input',
    }),
  },
  {
    types: ['ModuleNotFoundError', 'ImportError'],
    build: (_m, err, ctx) => ({
      category: 'environment',
      title: `Can’t find module ${code(ctx.module ?? 'module')}`,
      explanation: /sandbox/.test(err.message)
        ? 'That module is disabled in PyPath’s secure sandbox.'
        : 'This module isn’t available. Check the spelling — module names are lowercase, e.g. `math`, `random`, `pandas`.',
    }),
  },
  {
    types: ['FileNotFoundError'],
    build: (_m, err) => ({
      category: 'environment',
      title: 'File not found',
      explanation: `Python couldn’t find the file you tried to open (${err.message.replace(/^\[Errno 44\] /, '')}).`,
      hint: 'Check the file name and folder, e.g. `"data/report.csv"`. Paths are case-sensitive.',
      docRef: 'file-io',
    }),
  },
  {
    types: ['RecursionError'],
    build: () => ({
      title: 'Your function called itself forever',
      explanation: 'A function kept calling itself without ever stopping, until Python ran out of room.',
      hint: 'Every recursive function needs a *base case* that returns without calling itself again.',
      docRef: 'recursion',
    }),
  },
  {
    types: ['AssertionError'],
    build: (_m, err) => ({
      category: 'logic',
      title: 'A check didn’t pass',
      explanation: err.message || 'An `assert` statement found a value that wasn’t what was expected.',
    }),
  },
];

/**
 * Turns raw Python errors into learner-friendly explanations.
 * Uses the structured context the runner introspects from the failing frame
 * (e.g. index/length for IndexError) to be specific about *this* mistake.
 */
export function humanizeError(err: PyErrorInfo, source?: string): HumanizedError {
  const ctx = err.context ?? {};
  const lines = source?.split('\n');
  const codeLine = err.line != null && lines ? (lines[err.line - 1] ?? null) : null;

  for (const rule of RULES) {
    if (!rule.types.includes(err.type)) continue;
    const m = rule.pattern ? err.message.match(rule.pattern) : null;
    if (rule.pattern && !m) continue;
    const built = rule.build(m, err, ctx, codeLine);
    return {
      category: built.category ?? (SYNTAX_TYPES.includes(err.type) ? 'syntax' : 'runtime'),
      errorType: err.type,
      line: err.line,
      technical: err.formatted || `${err.type}: ${err.message}`,
      ...built,
    };
  }

  return {
    category: 'runtime',
    errorType: err.type,
    line: err.line,
    title: `${err.type}`,
    explanation: `Python stopped with ${code(err.type)}: ${err.message}`,
    hint: err.line ? `Look at line ${err.line}.` : undefined,
    technical: err.formatted || `${err.type}: ${err.message}`,
  };
}
