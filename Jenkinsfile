pipeline {
    agent { 
        // 'linux' is the (legacy) label used on ci.jenkins.io for "Docker Linux AMD64" while 'linux-amd64-docker' is the label used on infra.ci.jenkins.io
        label 'linux || linux-amd64-docker'
    }

    options {
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(daysToKeepStr: '10'))
        timestamps()
    }

    triggers {
        pollSCM('H * * * *')
    }

    stages { 
        stage('Build & test') {
            steps {
                sh 'make migrate check'
            }
            post {
                success {
                    stash name: 'build', includes: 'build/**/*'
                }
            }
        }

        stage('Container') {
            steps {
                buildDockerAndPublishImage('uplink', [unstash: 'build', targetplatforms: 'linux/amd64,linux/arm64', disablePublication: !infra.isInfra(), automaticSemanticVersioning: false])
            }
        }
    }
}

// vim: ft=groovy
