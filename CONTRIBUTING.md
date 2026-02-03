# Contributing

Thank you for your interest in contributing to `spoken-to-text-pipeline`! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- A Whisper ASR server (for testing ASR functionality)
- API keys for AI providers (OpenAI or DeepSeek) for testing AI features

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/spoken-to-text-pipeline.git
   cd spoken-to-text-pipeline
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Development Workflow

### Code Style

This project uses [Prettier](https://prettier.io/) for code formatting. Before committing, ensure your code is formatted:

```bash
npm run format
```

The project follows TypeScript best practices with strict type checking enabled.

### Testing

All contributions should include appropriate tests. The project uses Jest for testing.

- **Run tests**: `npm test`
- **Run tests in watch mode**: `npm run test:watch`
- **Run tests with coverage**: `npm run test:coverage`

**Test requirements:**
- New features should include unit tests
- Bug fixes should include regression tests
- Aim for maintaining or improving test coverage
- Tests should be placed in `tests/` directory mirroring the `src/` structure

### Building

Before submitting a PR, ensure the project builds successfully:

```bash
npm run build
```

## Making Changes

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Fix issues reported in GitHub Issues
- **New features**: Add functionality that aligns with the project's goals
- **Documentation**: Improve or add documentation
- **Tests**: Add or improve test coverage
- **Refactoring**: Improve code quality without changing functionality
- **Performance**: Optimize existing code

### Before You Start

1. **Check existing issues**: Look for open issues that might be related to your contribution
2. **Open an issue first** (for major changes): For significant features or changes, consider opening an issue to discuss the approach before implementing
3. **Keep changes focused**: Each PR should address a single concern or feature

### Pull Request Process

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**:
   - Write clean, well-documented code
   - Follow existing code patterns and conventions
   - Add tests for new functionality
   - Update documentation if needed

3. **Ensure quality**:
   ```bash
   npm run format      # Format code
   npm run build       # Verify build succeeds
   npm test            # Run tests
   ```

4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Reference issue numbers if applicable (e.g., "Fix #123: ...")

5. **Push and create a Pull Request**:
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a PR on GitHub with:
   - A clear title and description
   - Reference to related issues (if any)
   - Description of changes and testing performed

### PR Review Checklist

Before submitting, ensure:

- [ ] Code follows the project's style guidelines
- [ ] All tests pass (`npm test`)
- [ ] Project builds successfully (`npm run build`)
- [ ] Code is formatted (`npm run format`)
- [ ] New features include tests
- [ ] Documentation is updated if needed
- [ ] Commit messages are clear and descriptive

## Project Structure

Understanding the project structure will help you contribute effectively:

```
src/
├── cli/              # CLI argument parsing and interface
├── config/           # Configuration loading and validation
├── pipeline/         # Pipeline orchestration and steps
│   └── steps/        # Individual pipeline steps
├── services/         # External service integrations
│   ├── ai/           # AI provider services (OpenAI, DeepSeek)
│   └── asr/          # ASR service (Whisper)
└── utils/            # Utility functions

tests/                # Test files mirroring src/ structure
docs/                 # Documentation
```

## Questions?

If you have questions or need help:

- Open an issue on GitHub
- Check existing documentation in the `docs/` directory
- Review existing code and tests for examples

## Code of Conduct

- Be respectful and considerate
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Collaborate in good faith

Thank you for contributing to `spoken-to-text-pipeline`!
