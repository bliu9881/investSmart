# Portfolio Intelligence Platform - Architecture Plan

## Application Purpose

AI-powered investment platform with two primary flows:
1. **Build from Scratch** - AI generates tailored portfolio recommendations from user preferences
2. **Import & Analyze** - Users import existing holdings for health analysis and rebalancing suggestions

Both flows supported by multi-dimensional stock analysis, stock comparison, and conversational AI chat.

## Architecture

```
Frontend (React + TypeScript + Vite + Tailwind) → AWS Amplify
    ↓ JWT
API Gateway + Lambda Orchestrator
    ↓
AgentCore Runtime (8 Strands Agents)
    ↓ MCP Protocol
Gateway Tools (Lambda functions) → yfinance, NewsAPI
    ↓
DynamoDB (5 tables)
```

## Agents

| Agent | Purpose | Pattern |
|-------|---------|---------|
| Portfolio Builder | Generate diversified recommendations | patterns/portfolio-builder/ |
| Chat Agent | Investment Q&A with context | patterns/chat-agent/ |
| Sentiment Analyzer | Market mood scoring (-100 to +100) | patterns/sentiment-analyzer/ |
| Fundamental Analyzer | Financial health ratios vs sector medians | patterns/fundamental-analyzer/ |
| Technical Analyzer | SMA, RSI, MACD, Bollinger Bands | patterns/technical-analyzer/ |
| News Analyzer | 7-day news impact assessment | patterns/news-analyzer/ |
| Report Aggregator | Analyst consensus and price targets | patterns/report-aggregator/ |
| Portfolio Analyzer | Health scoring and rebalancing | patterns/portfolio-analyzer/ |

## Gateway Tools

| Tool Group | Lambda | Functions |
|-----------|--------|-----------|
| Stock Data | stock_data_lambda | get_stock_data, validate_ticker |
| Financial Data | financial_data_lambda | get_fundamentals, get_price_history, get_sector_medians |
| News & Sentiment | news_sentiment_lambda | get_recent_news, get_sentiment_data |
| Analyst Data | analyst_data_lambda | get_analyst_reports |
| Portfolio Data | portfolio_data_lambda | read_portfolio, read_analysis_cache, parse_csv_holdings |
| Orchestrator | orchestrator_lambda | full_analysis, single_analysis, generate_portfolio |

## Frontend Pages

| Route | Page | Purpose |
|-------|------|---------|
| / | Dashboard | Dual-flow view of all portfolios |
| /onboarding | Onboarding | Step-by-step preference setup |
| /build | Build | Generate new portfolio |
| /build/:id | Portfolio Detail | View/edit generated portfolio |
| /analyze | Analyze | Import flow landing |
| /analyze/import | Import | Manual entry + CSV upload |
| /analyze/:id | Imported Portfolio | View holdings |
| /analyze/:id/health | Health Report | Diversification + rebalancing |
| /stocks/:ticker | Stock Analysis | 5 insight cards + composite score |
| /compare | Compare | Side-by-side stock comparison |
| /preferences | Preferences | Edit investment preferences |

## Data Model (DynamoDB)

- **invest-smart-users** - User preference profiles
- **invest-smart-portfolios** - Generated and imported portfolios
- **invest-smart-holdings** - Individual stock positions
- **invest-smart-analysis-cache** - Cached analysis results with TTL
- **invest-smart-health-reports** - Portfolio health assessments
