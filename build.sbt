ThisBuild / scalaVersion := "3.3.1"

lazy val root = (project in file("."))
  .settings(
    name := "schematic-trace-solver",
    version := "0.1.0",

    libraryDependencies += "org.scalatest" %% "scalatest" % "3.2.18" % Test,

    Test / fork := true
  )
