import * as cdk from "aws-cdk-lib"
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import { Construct } from "constructs"
import { AppConfig } from "./utils/config-manager"

export interface DatabaseStackProps extends cdk.NestedStackProps {
  config: AppConfig
}

export class DatabaseStack extends cdk.NestedStack {
  public readonly usersTable: dynamodb.Table
  public readonly portfoliosTable: dynamodb.Table
  public readonly holdingsTable: dynamodb.Table
  public readonly analysisCacheTable: dynamodb.Table
  public readonly healthReportsTable: dynamodb.Table
  public readonly jobsTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props)

    const { config } = props

    // Users table - stores user preference profiles
    this.usersTable = new dynamodb.Table(this, "UsersTable", {
      tableName: `${config.stack_name_base}-users`,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Portfolios table - stores portfolio data per user
    this.portfoliosTable = new dynamodb.Table(this, "PortfoliosTable", {
      tableName: `${config.stack_name_base}-portfolios`,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "portfolioId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // GSI for filtering portfolios by type
    this.portfoliosTable.addGlobalSecondaryIndex({
      indexName: "type-created-index",
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "typeCreated",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Holdings table - stores individual holdings per portfolio
    this.holdingsTable = new dynamodb.Table(this, "HoldingsTable", {
      tableName: `${config.stack_name_base}-holdings`,
      partitionKey: {
        name: "portfolioId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "holdingId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Analysis cache table - caches analysis results with TTL
    this.analysisCacheTable = new dynamodb.Table(this, "AnalysisCacheTable", {
      tableName: `${config.stack_name_base}-analysis-cache`,
      partitionKey: {
        name: "ticker",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "analysisType",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "ttl",
    })

    // Health reports table - stores portfolio health reports
    this.healthReportsTable = new dynamodb.Table(this, "HealthReportsTable", {
      tableName: `${config.stack_name_base}-health-reports`,
      partitionKey: {
        name: "portfolioId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "reportId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })
    // Jobs table - tracks async portfolio generation jobs
    this.jobsTable = new dynamodb.Table(this, "JobsTable", {
      tableName: `${config.stack_name_base}-jobs`,
      partitionKey: {
        name: "jobId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: "expiresAt",
    })
  }
}
