# Application Description

A web storefront for "Tony's world of chips". It sells various brands of potato chips. The front page is a list of chips, which you can add to your cart. It will have a web frontend, an API layer, and the API layer talks to a postgres database. Write it in typescript.

# Deployment Specification

All deployment is managed by System Initiative.

The web application and the API layer should be packaged into docker containers. 

They should be tagged with a the data and the gitsha as a single version tag every time they are produced - YYYYMMDDHHMMSS-gitsha.

The containers should deploy to AWS ECS.

Those containers get deployed to the latest version of amazon linux.

The API layer needs to be configured to talk to a remote postres databse using RDS.

The Web app should be behidn a public load balancer (and in a private subnet).

The API should be behind an internal load balancer (and in a private subnet).

The databsae layer should have its own subnet.

The web app should be able to route to the API, but not the database layer.

It should be in its own VPC.

It should include security groups and IAM policies as needed.


