(function (globalScope) {
  const DEFAULT_MODE = 'deg';

  function toRadians(value, mode) {
    if (mode === 'deg') {
      return (value * Math.PI) / 180;
    }
    return value;
  }

  function normalizeInput(expression) {
    return String(expression || '')
      .trim()
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'PI')
      .replace(/ℯ/g, 'E')
      .replace(/\s+/g, '');
  }

  function tokenize(source) {
    const tokens = [];
    const normalized = normalizeInput(source);
    let index = 0;

    while (index < normalized.length) {
      const char = normalized[index];

      if (/\d|\./.test(char)) {
        let number = char;
        index += 1;

        while (index < normalized.length && /[0-9.]/.test(normalized[index])) {
          number += normalized[index];
          index += 1;
        }

        if (number.split('.').length > 2 || (number === '.' && index >= normalized.length)) {
          throw new Error('Invalid numeric literal');
        }

        tokens.push({ type: 'number', value: Number(number) });
        continue;
      }

      if (/[A-Za-z]/.test(char)) {
        let ident = char;
        index += 1;

        while (index < normalized.length && /[A-Za-z]/.test(normalized[index])) {
          ident += normalized[index];
          index += 1;
        }

        const upper = ident.toUpperCase();
        if (upper === 'PI' || upper === 'E') {
          tokens.push({ type: 'constant', value: upper === 'PI' ? Math.PI : Math.E });
        } else {
          tokens.push({ type: 'identifier', value: upper });
        }
        continue;
      }

      if ('+-*/%()^'.includes(char)) {
        if (char === '^' && normalized[index + 1] === '^') {
          tokens.push({ type: 'operator', value: '**' });
          index += 2;
          continue;
        }
        tokens.push({ type: 'operator', value: char });
        index += 1;
        continue;
      }

      throw new Error(`Unsupported character: ${char}`);
    }

    return tokens;
  }

  class ExpressionParser {
    constructor(tokens, mode) {
      this.tokens = tokens;
      this.index = 0;
      this.mode = mode || DEFAULT_MODE;
    }

    peek() {
      return this.tokens[this.index] || null;
    }

    consume(expectedValue) {
      const token = this.peek();
      if (!token || token.type !== 'operator' || token.value !== expectedValue) {
        throw new Error(`Expected operator ${expectedValue}`);
      }
      this.index += 1;
      return token;
    }

    matchOperator(value) {
      const token = this.peek();
      if (token && token.type === 'operator' && token.value === value) {
        this.index += 1;
        return true;
      }
      return false;
    }

    parse() {
      const value = this.parseExpression();
      if (this.peek()) {
        throw new Error('Unexpected token at end of expression');
      }
      return value;
    }

    parseExpression() {
      return this.parseAddSub();
    }

    parseAddSub() {
      let value = this.parseMultiplyDivide();

      while (this.matchOperator('+') || this.matchOperator('-')) {
        const op = this.tokens[this.index - 1].value;
        const rhs = this.parseMultiplyDivide();
        value = op === '+' ? value + rhs : value - rhs;
      }

      return value;
    }

    parseMultiplyDivide() {
      let value = this.parseUnary();

      while (true) {
        const token = this.peek();
        if (!token || token.type !== 'operator') {
          break;
        }

        if (token.value === '*' || token.value === '/' || token.value === '%') {
          this.index += 1;
          const rhs = this.parseUnary();
          if (token.value === '*') value *= rhs;
          if (token.value === '/') value /= rhs;
          if (token.value === '%') value %= rhs;
          continue;
        }
        break;
      }

      return value;
    }

    parseUnary() {
      const token = this.peek();
      if (token && token.type === 'operator' && (token.value === '+' || token.value === '-')) {
        this.index += 1;
        return (token.value === '-' ? -1 : 1) * this.parseUnary();
      }
      return this.parsePower();
    }

    parsePower() {
      let value = this.parsePrimary();
      if (this.matchOperator('^') || this.matchOperator('**')) {
        const exponent = this.parseUnary();
        value = Math.pow(value, exponent);
      }
      return value;
    }

    parsePrimary() {
      const token = this.peek();

      if (!token) {
        throw new Error('Expression ended unexpectedly');
      }

      if (token.type === 'number') {
        this.index += 1;
        return token.value;
      }

      if (token.type === 'constant') {
        this.index += 1;
        return token.value;
      }

      if (token.type === 'identifier') {
        const name = token.value;
        this.index += 1;

        if (this.peek() && this.peek().type === 'operator' && this.peek().value === '(') {
          this.index += 1;
          const arg = this.parseExpression();
          this.consume(')');
          return this.applyFunction(name, arg);
        }

        if (name === 'PI') return Math.PI;
        if (name === 'E') return Math.E;
        throw new Error(`Unknown identifier: ${name}`);
      }

      if (token.type === 'operator' && token.value === '(') {
        this.index += 1;
        const inner = this.parseExpression();
        this.consume(')');
        return inner;
      }

      throw new Error(`Unexpected token: ${token.value}`);
    }

    applyFunction(name, value) {
      switch (name) {
        case 'SIN': return Math.sin(toRadians(value, this.mode));
        case 'COS': return Math.cos(toRadians(value, this.mode));
        case 'TAN': return Math.tan(toRadians(value, this.mode));
        case 'ASIN': return (Math.asin(value) * 180) / Math.PI;
        case 'ACOS': return (Math.acos(value) * 180) / Math.PI;
        case 'ATAN': return (Math.atan(value) * 180) / Math.PI;
        case 'SQRT': return Math.sqrt(value);
        case 'LOG': return Math.log10(value);
        case 'LN': return Math.log(value);
        case 'ABS': return Math.abs(value);
        case 'EXP': return Math.exp(value);
        case 'ROUND': return Math.round(value);
        case 'FLOOR': return Math.floor(value);
        case 'CEIL': return Math.ceil(value);
        case 'POW': return Math.pow(value, 2);
        default:
          throw new Error(`Unsupported function: ${name}`);
      }
    }
  }

  function evaluateScientificExpression(expression, mode = DEFAULT_MODE) {
    const cleanExpression = normalizeInput(expression);
    if (!cleanExpression) {
      return 0;
    }

    const parser = new ExpressionParser(tokenize(cleanExpression), mode);
    return parser.parse();
  }

  const calculatorApi = {
    DEFAULT_MODE,
    evaluateScientificExpression,
    normalizeInput,
    tokenize,
    ExpressionParser
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = calculatorApi;
  }

  globalScope.ScientificCalculator = calculatorApi;
})(typeof window !== 'undefined' ? window : globalThis);
