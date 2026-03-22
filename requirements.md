# Requirements Document

## Introduction

The Portfolio Intelligence Platform is a full-stack application that helps investors build and manage healthy investment portfolios using AI. The platform supports two primary flows: (1) Build from Scratch, where users provide investment preferences and the AI generates tailored portfolio recommendations, and (2) Import and Analyze, where users import existing holdings and receive health analysis, risk assessment, and AI-driven rebalancing suggestions. Both flows are supported by multi-dimensional analysis (sentiment, fundamentals, technicals, news, analyst reports), stock comparison, and conversational AI chat for investment questions. Built on AWS using Amplify for the frontend/backend and AgentCore with Strands Agents for AI orchestration.

## Glossary

- **Platform**: The Portfolio Intelligence Platform application as a whole
- **User**: An authenticated person interacting with the Platform
- **Preference_Profile**: A structured set of user inputs including risk tolerance, preferred sectors, favorite stocks, and investment horizon that drives portfolio recommendations
- **Risk_Tolerance**: A user-selected level (Conservative, Moderate, Aggressive) indicating appetite for investment risk
- **Investment_Horizon**: The user's intended timeframe for holding investments (Short-term: under 1 year, Medium-term: 1–5 years, Long-term: over 5 years)
- **Portfolio_Builder**: The AI agent responsible for generating diversified portfolio recommendations based on a user's Preference_Profile
- **Recommendation**: A suggested stock with an allocation weight, rationale, and supporting analysis data produced by the Portfolio_Builder
- **Portfolio**: A collection of Recommendations generated for a user, which the user can accept, modify, or regenerate
- **Stock**: A publicly traded equity security identified by its ticker symbol
- **Comparison_View**: A UI component that displays multiple stocks side by side across key metrics
- **Chat_Agent**: The AI agent responsible for handling conversational investment questions from users
- **Sentiment_Analyzer**: The AI agent responsible for analyzing market sentiment from social media, forums, and news headlines for a given stock
- **Fundamental_Analyzer**: The AI agent responsible for evaluating a stock's financial health using financial statements, ratios, and valuation metrics
- **Technical_Analyzer**: The AI agent responsible for computing and interpreting technical indicators from price and volume data
- **News_Analyzer**: The AI agent responsible for assessing the impact of recent news articles on a stock's outlook
- **Report_Aggregator**: The AI agent responsible for collecting and summarizing analyst reports and recommendations for a given stock
- **Orchestrator**: The AgentCore-based coordination layer that routes user queries to the appropriate Strands Agents and merges their outputs
- **Insight_Card**: A UI component that presents a single dimension of analysis (sentiment, fundamental, technical, news, or analyst) for a stock
- **Composite_Score**: A weighted aggregate score combining sentiment, fundamental, technical, news, and analyst signals into a single indicator for a stock
- **Imported_Portfolio**: A collection of Holdings that a user has entered or uploaded representing their existing real-world investments
- **Holding**: A single position within an Imported_Portfolio, consisting of a Stock ticker, quantity of shares, and optional cost basis per share
- **Health_Report**: An AI-generated assessment of an Imported_Portfolio covering diversification, risk exposure, sector concentration, and overall quality
- **Portfolio_Analyzer**: The AI agent responsible for evaluating an Imported_Portfolio and producing a Health_Report
- **Rebalancing_Suggestion**: An AI-generated recommendation to add, remove, or adjust a Holding within an Imported_Portfolio to improve portfolio health
- **CSV_Importer**: The component responsible for parsing brokerage CSV export files into a structured list of Holdings
- **Sector_Concentration**: The percentage of total portfolio value allocated to a single sector, used to identify over-concentration risk
- **Diversification_Score**: A 0–100 score indicating how well an Imported_Portfolio is spread across sectors, market caps, and asset characteristics

## Requirements

### Requirement 1: User Authentication and Profile Management

**User Story:** As a user, I want to securely sign up, sign in, and manage my profile, so that my preferences and generated portfolios are private and persistent.

#### Acceptance Criteria

1. WHEN a user submits valid registration credentials, THE Platform SHALL create an authenticated account and redirect the user to the preference input screen.
2. WHEN a user submits valid login credentials, THE Platform SHALL authenticate the user and grant access within 2 seconds.
3. IF a user submits invalid credentials three consecutive times, THEN THE Platform SHALL temporarily lock the account for 15 minutes and notify the user.
4. THE Platform SHALL enforce HTTPS for all authentication-related communication.

### Requirement 2: Investment Preference Input

**User Story:** As a user, I want to provide my investment preferences, so that the AI can generate portfolio recommendations tailored to my goals.

#### Acceptance Criteria

1. THE Platform SHALL present a Preference_Profile form that collects Risk_Tolerance (Conservative, Moderate, Aggressive), preferred sectors or industries (selectable from a predefined list), optional favorite stock ticker symbols, and Investment_Horizon (Short-term, Medium-term, Long-term).
2. WHEN a user submits a completed Preference_Profile, THE Platform SHALL validate that Risk_Tolerance and Investment_Horizon are selected before accepting the submission.
3. WHEN a user provides favorite stock ticker symbols, THE Platform SHALL validate each ticker against a known securities database and flag invalid tickers with a descriptive error.
4. THE Platform SHALL allow a user to update the Preference_Profile at any time, and THE Platform SHALL persist the changes.
5. WHEN a user updates the Preference_Profile, THE Platform SHALL offer to regenerate portfolio recommendations based on the updated preferences.
6. IF a user does not select any preferred sectors, THEN THE Platform SHALL treat all sectors as eligible for recommendations.

### Requirement 3: AI-Driven Portfolio Recommendations

**User Story:** As a user, I want the AI to generate a diversified portfolio of stock recommendations based on my preferences, so that I can build a healthy portfolio from scratch.

#### Acceptance Criteria

1. WHEN a user requests portfolio generation, THE Orchestrator SHALL invoke the Portfolio_Builder agent with the user's Preference_Profile.
2. WHEN the Portfolio_Builder completes generation, THE Platform SHALL display a list of Recommendations, each containing the stock ticker, company name, suggested allocation percentage, and a plain-language rationale explaining why the stock was recommended.
3. THE Portfolio_Builder SHALL generate a minimum of 5 and a maximum of 20 Recommendations per portfolio.
4. THE Portfolio_Builder SHALL ensure that the recommended allocation percentages sum to 100%.
5. THE Portfolio_Builder SHALL diversify Recommendations across at least 3 distinct sectors, unless the user's Preference_Profile restricts sectors to fewer than 3.
6. WHEN Risk_Tolerance is Conservative, THE Portfolio_Builder SHALL weight Recommendations toward stocks with lower historical volatility and higher dividend yields.
7. WHEN Risk_Tolerance is Aggressive, THE Portfolio_Builder SHALL weight Recommendations toward stocks with higher growth potential and momentum indicators.
8. WHEN the Portfolio_Builder produces Recommendations, THE Platform SHALL display a portfolio summary showing total sector allocation breakdown and overall risk profile.
9. IF the Portfolio_Builder cannot generate Recommendations meeting the diversification criteria, THEN THE Platform SHALL inform the user and suggest broadening sector preferences.

### Requirement 4: Portfolio Review and Customization

**User Story:** As a user, I want to review, modify, and regenerate my AI-suggested portfolio, so that I have full control over my final investment plan.

#### Acceptance Criteria

1. WHEN a user views a generated Portfolio, THE Platform SHALL allow the user to remove individual Recommendations from the Portfolio.
2. WHEN a user removes a Recommendation, THE Platform SHALL redistribute the freed allocation proportionally among remaining Recommendations and update the display within 1 second.
3. WHEN a user requests regeneration, THE Orchestrator SHALL invoke the Portfolio_Builder agent with the current Preference_Profile to produce a new set of Recommendations.
4. THE Platform SHALL allow a user to save multiple named Portfolios for comparison.
5. WHEN a user saves a Portfolio, THE Platform SHALL persist the Portfolio with a timestamp and the Preference_Profile used to generate the Portfolio.

### Requirement 5: Stock Comparison

**User Story:** As a user, I want to compare multiple stocks side by side, so that I can make informed decisions about which stocks to include in my portfolio.

#### Acceptance Criteria

1. WHEN a user selects two or more stocks for comparison, THE Platform SHALL display a Comparison_View showing key metrics side by side.
2. THE Comparison_View SHALL display at minimum: current price, 52-week high and low, P/E ratio, dividend yield, market capitalization, sector, and Composite_Score for each selected stock.
3. THE Comparison_View SHALL allow a user to compare up to 5 stocks simultaneously.
4. IF a user selects more than 5 stocks for comparison, THEN THE Platform SHALL display an error message stating the maximum comparison limit.
5. WHEN a user views the Comparison_View, THE Platform SHALL highlight the leading stock for each metric using a visual indicator.
6. WHEN a user is viewing a generated Portfolio, THE Platform SHALL allow the user to select Recommendations and open them in the Comparison_View.
7. WHEN a user is viewing an Imported_Portfolio, THE Platform SHALL allow the user to select Holdings and open them in the Comparison_View.

### Requirement 6: Conversational Chat Interface

**User Story:** As a user, I want to ask investment-related questions through a chat interface, so that I can get AI-powered answers conversationally.

#### Acceptance Criteria

1. THE Platform SHALL provide a persistent chat interface accessible from all screens.
2. WHEN a user submits a question through the chat interface, THE Orchestrator SHALL route the question to the Chat_Agent.
3. WHEN the Chat_Agent receives a question, THE Chat_Agent SHALL respond with a relevant answer within 10 seconds.
4. THE Chat_Agent SHALL answer questions about stock analysis, portfolio strategy, market concepts, the user's current Recommendations, and the user's Imported_Portfolios including Health_Reports and Rebalancing_Suggestions.
5. WHEN the Chat_Agent references specific stocks, THE Chat_Agent SHALL include current data points (price, key ratios, or scores) in the response.
6. THE Chat_Agent SHALL maintain conversation context within a session, allowing follow-up questions without repeating prior context.
7. IF the Chat_Agent receives a question outside the investment domain, THEN THE Chat_Agent SHALL respond with a message indicating the question is outside the supported scope.
8. THE Platform SHALL display chat history for the current session and allow the user to start a new session.

### Requirement 7: Sentiment Analysis

**User Story:** As a user, I want to see market sentiment analysis for stocks, so that I can understand the prevailing market mood when evaluating recommendations.

#### Acceptance Criteria

1. WHEN a user requests sentiment analysis for a Stock, THE Orchestrator SHALL invoke the Sentiment_Analyzer agent for that Stock.
2. WHEN the Sentiment_Analyzer completes analysis, THE Platform SHALL display a sentiment score on a scale of -100 (extreme fear) to +100 (extreme greed) on an Insight_Card.
3. THE Sentiment_Analyzer SHALL analyze data from at least three distinct source categories (social media, financial forums, news headlines).
4. WHEN the Sentiment_Analyzer produces a score, THE Insight_Card SHALL display the top three contributing factors with source attribution.
5. IF the Sentiment_Analyzer cannot retrieve sufficient data for a Stock, THEN THE Platform SHALL display a "limited data" indicator on the Insight_Card.

### Requirement 8: Fundamental Analysis

**User Story:** As a user, I want to see fundamental analysis of stocks, so that I can evaluate financial health when building my portfolio.

#### Acceptance Criteria

1. WHEN a user requests fundamental analysis for a Stock, THE Orchestrator SHALL invoke the Fundamental_Analyzer agent for that Stock.
2. WHEN the Fundamental_Analyzer completes analysis, THE Platform SHALL display key financial ratios (P/E, P/B, debt-to-equity, ROE, free cash flow yield) on an Insight_Card.
3. THE Fundamental_Analyzer SHALL compare the Stock's ratios against sector median values and indicate whether each ratio is above, at, or below the sector median.
4. WHEN the Fundamental_Analyzer produces results, THE Insight_Card SHALL display a fundamental health rating of Strong, Moderate, or Weak with a supporting summary.
5. IF financial data for a Stock is older than one fiscal quarter, THEN THE Platform SHALL display a staleness warning alongside the analysis.

### Requirement 9: Technical Analysis

**User Story:** As a user, I want to see technical indicator analysis for stocks, so that I can identify trends and momentum when evaluating recommendations.

#### Acceptance Criteria

1. WHEN a user requests technical analysis for a Stock, THE Orchestrator SHALL invoke the Technical_Analyzer agent for that Stock.
2. THE Technical_Analyzer SHALL compute at minimum: 50-day SMA, 200-day SMA, RSI (14-period), MACD (12, 26, 9), and Bollinger Bands (20-period, 2 standard deviations).
3. WHEN the Technical_Analyzer completes analysis, THE Platform SHALL display each indicator value and its interpretation (bullish, bearish, or neutral) on an Insight_Card.
4. THE Platform SHALL display an interactive price chart overlaid with the computed technical indicators for the selected Stock.
5. IF price data for a Stock is unavailable for the required lookback period, THEN THE Platform SHALL indicate which indicators could not be computed and the reason.

### Requirement 10: News Impact Analysis

**User Story:** As a user, I want to understand how recent news affects stocks, so that I can factor current events into my portfolio decisions.

#### Acceptance Criteria

1. WHEN a user requests news analysis for a Stock, THE Orchestrator SHALL invoke the News_Analyzer agent for that Stock.
2. THE News_Analyzer SHALL analyze news articles published within the last 7 calendar days for the requested Stock.
3. WHEN the News_Analyzer completes analysis, THE Platform SHALL display each article's title, source, publication date, and an impact rating of High, Medium, or Low on an Insight_Card.
4. THE News_Analyzer SHALL classify each article's expected impact direction as Positive, Negative, or Neutral for the Stock.
5. IF no relevant news articles are found for a Stock within the 7-day window, THEN THE Platform SHALL display a "No recent news" message on the Insight_Card.

### Requirement 11: Analyst Reports

**User Story:** As a user, I want to see aggregated analyst recommendations, so that I can factor professional opinions into my portfolio building.

#### Acceptance Criteria

1. WHEN a user requests analyst reports for a Stock, THE Orchestrator SHALL invoke the Report_Aggregator agent for that Stock.
2. WHEN the Report_Aggregator completes aggregation, THE Platform SHALL display a consensus recommendation (Strong Buy, Buy, Hold, Sell, Strong Sell) on an Insight_Card.
3. THE Report_Aggregator SHALL aggregate recommendations from at least five distinct analyst sources when available.
4. THE Insight_Card SHALL display the average analyst price target and the range (low to high) for the Stock.
5. IF fewer than three analyst reports are available for a Stock, THEN THE Platform SHALL display a "limited coverage" indicator alongside the available data.

### Requirement 12: Composite Score

**User Story:** As a user, I want a single composite score for each stock, so that I can quickly assess overall quality when reviewing recommendations.

#### Acceptance Criteria

1. WHEN all five analysis agents (Sentiment_Analyzer, Fundamental_Analyzer, Technical_Analyzer, News_Analyzer, Report_Aggregator) have returned results for a Stock, THE Orchestrator SHALL compute a Composite_Score.
2. THE Composite_Score SHALL be a weighted average on a 0–100 scale, combining sentiment (20%), fundamental (25%), technical (20%), news (15%), and analyst (20%) dimensions.
3. WHEN the Composite_Score is computed, THE Platform SHALL display the score with a color-coded indicator: green (70–100), yellow (40–69), red (0–39).
4. IF one or more analysis agents fail to return results for a Stock, THEN THE Orchestrator SHALL compute the Composite_Score using available dimensions with proportionally adjusted weights and display which dimensions are missing.

### Requirement 13: AI Agent Orchestration

**User Story:** As a user, I want analysis and recommendation requests to be handled efficiently by coordinated AI agents, so that I receive comprehensive results in a timely manner.

#### Acceptance Criteria

1. WHEN a user requests a full analysis for a Stock, THE Orchestrator SHALL invoke all five analysis agents in parallel.
2. THE Orchestrator SHALL return consolidated results to the Platform within 30 seconds of the initial request.
3. IF an individual agent fails to respond within 15 seconds, THEN THE Orchestrator SHALL return partial results from the completed agents and mark the timed-out agent's Insight_Card as "Analysis unavailable — retry available."
4. WHEN a user clicks "retry" on an unavailable Insight_Card, THE Orchestrator SHALL re-invoke only the failed agent for that Stock.
5. THE Orchestrator SHALL log each agent invocation with a request identifier, agent name, start time, end time, and status (success or failure) for observability.

### Requirement 14: Dashboard and Visualization

**User Story:** As a user, I want a comprehensive dashboard, so that I can view my generated portfolios, imported portfolios, recommendations, and analysis in a single organized interface.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Dashboard, THE Platform SHALL display saved Portfolios with each Recommendation's stock ticker, allocation percentage, and Composite_Score.
2. THE Dashboard SHALL provide a portfolio-level summary showing sector allocation breakdown and overall risk profile.
3. WHEN a user selects a Stock from a Portfolio, THE Platform SHALL display all five Insight_Cards (sentiment, fundamental, technical, news, analyst) for that Stock.
4. THE Dashboard SHALL be responsive and render correctly on screen widths from 375px to 2560px.
5. WHEN new analysis results become available for a Stock, THE Dashboard SHALL update the displayed data without requiring a full page reload.

### Requirement 15: Existing Portfolio Import — Manual Entry

**User Story:** As a user, I want to manually enter my existing stock holdings, so that the platform can analyze my current portfolio.

#### Acceptance Criteria

1. THE Platform SHALL provide a Holdings entry form that collects a Stock ticker symbol, quantity of shares, and optional cost basis per share for each Holding.
2. WHEN a user submits a Holding entry, THE Platform SHALL validate the ticker symbol against a known securities database and flag invalid tickers with a descriptive error.
3. THE Platform SHALL allow a user to add, edit, and remove individual Holdings within an Imported_Portfolio before submitting for analysis.
4. WHEN a user submits an Imported_Portfolio, THE Platform SHALL validate that the Imported_Portfolio contains at least one Holding with a positive share quantity.
5. THE Platform SHALL persist each Imported_Portfolio with a user-assigned name and a timestamp.
6. WHEN a user provides a cost basis per share for a Holding, THE Platform SHALL use the cost basis to compute unrealized gain or loss for that Holding based on the current market price.

### Requirement 16: Existing Portfolio Import — CSV Upload

**User Story:** As a user, I want to upload a CSV file of my brokerage holdings, so that I can quickly import my portfolio without manual entry.

#### Acceptance Criteria

1. THE Platform SHALL accept CSV file uploads with a maximum file size of 5 MB.
2. WHEN a user uploads a CSV file, THE CSV_Importer SHALL parse the file and extract ticker symbols, share quantities, and cost basis values from recognized column headers.
3. THE CSV_Importer SHALL support common brokerage export formats by recognizing column header variations (e.g., "Symbol", "Ticker", "Stock Symbol" for ticker; "Shares", "Quantity", "Qty" for quantity; "Cost Basis", "Average Cost", "Purchase Price" for cost basis).
4. WHEN the CSV_Importer successfully parses a file, THE Platform SHALL display the extracted Holdings in an editable review table before the user confirms the import.
5. IF the CSV_Importer encounters rows with unrecognized ticker symbols, THEN THE Platform SHALL flag those rows with a warning and allow the user to correct or remove them.
6. IF the CSV_Importer cannot parse the uploaded file due to an unsupported format, THEN THE Platform SHALL display a descriptive error message and provide a downloadable CSV template showing the expected format.
7. WHEN a user confirms the reviewed Holdings, THE Platform SHALL create an Imported_Portfolio with the confirmed Holdings.

### Requirement 17: Portfolio Health Analysis

**User Story:** As a user, I want to see a comprehensive health analysis of my imported portfolio, so that I can understand its strengths and weaknesses.

#### Acceptance Criteria

1. WHEN a user requests analysis of an Imported_Portfolio, THE Orchestrator SHALL invoke the Portfolio_Analyzer agent with the Imported_Portfolio's Holdings.
2. WHEN the Portfolio_Analyzer completes analysis, THE Platform SHALL display a Health_Report containing a Diversification_Score, sector allocation breakdown, and overall risk profile.
3. THE Portfolio_Analyzer SHALL identify Sector_Concentration risks where any single sector exceeds 30% of total portfolio value and flag those sectors in the Health_Report.
4. THE Portfolio_Analyzer SHALL assess the portfolio's alignment with common risk profiles (Conservative, Moderate, Aggressive) and report the detected risk level.
5. THE Health_Report SHALL display the portfolio's exposure distribution across market capitalizations (large-cap, mid-cap, small-cap).
6. WHEN cost basis data is available for Holdings, THE Health_Report SHALL display total unrealized gain or loss and per-Holding gain or loss percentages.
7. THE Portfolio_Analyzer SHALL invoke the five analysis agents (Sentiment_Analyzer, Fundamental_Analyzer, Technical_Analyzer, News_Analyzer, Report_Aggregator) for each Holding and incorporate the Composite_Scores into the Health_Report.
8. IF the Portfolio_Analyzer cannot retrieve market data for a Holding, THEN THE Platform SHALL flag that Holding as "data unavailable" in the Health_Report and exclude the Holding from aggregate calculations.

### Requirement 18: AI-Driven Rebalancing Suggestions

**User Story:** As a user, I want AI-generated rebalancing suggestions for my imported portfolio, so that I can improve its health and alignment with my goals.

#### Acceptance Criteria

1. WHEN a Health_Report is generated for an Imported_Portfolio, THE Portfolio_Analyzer SHALL produce a list of Rebalancing_Suggestions.
2. EACH Rebalancing_Suggestion SHALL specify an action (Add, Remove, Increase, Decrease), a Stock ticker, a suggested target allocation percentage, and a plain-language rationale.
3. WHEN a user has a Preference_Profile, THE Portfolio_Analyzer SHALL align Rebalancing_Suggestions with the user's Risk_Tolerance and Investment_Horizon.
4. IF a user does not have a Preference_Profile, THEN THE Portfolio_Analyzer SHALL generate Rebalancing_Suggestions targeting a Moderate risk profile and prompt the user to set preferences for more tailored suggestions.
5. THE Portfolio_Analyzer SHALL prioritize Rebalancing_Suggestions that address identified Sector_Concentration risks and low Diversification_Scores.
6. WHEN a user accepts a Rebalancing_Suggestion, THE Platform SHALL update the Imported_Portfolio's Holdings to reflect the accepted change and recalculate the Health_Report.
7. THE Platform SHALL allow a user to accept, dismiss, or defer individual Rebalancing_Suggestions independently.

### Requirement 19: Dual-Flow Navigation and Dashboard Integration

**User Story:** As a user, I want a unified experience that lets me switch between building a new portfolio and analyzing my existing holdings, so that I can manage all my investment activities in one place.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Dashboard, THE Platform SHALL display both saved generated Portfolios and saved Imported_Portfolios in distinct sections.
2. THE Platform SHALL provide a primary navigation element that allows the user to choose between "Build New Portfolio" and "Analyze Existing Portfolio" flows.
3. WHEN a user views an Imported_Portfolio on the Dashboard, THE Platform SHALL display the Health_Report summary including Diversification_Score, sector allocation, risk profile, and count of pending Rebalancing_Suggestions.
4. WHEN a user selects a Holding from an Imported_Portfolio, THE Platform SHALL display all five Insight_Cards (sentiment, fundamental, technical, news, analyst) for that Holding's Stock.
5. THE Platform SHALL allow a user to add a Stock from a generated Portfolio's Recommendations into an Imported_Portfolio as a new Holding.
