{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
# go templating language 
{{- define "name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 24 | trimSuffix "-" -}}
{{- end -}}

{{- define "appname" -}}
{{- printf "%s-%s" .Release.Name .Values.biomageCi.sandboxId | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "hostname" -}}
{{- if (eq .Values.kubernetes.env "production") -}}
{{- printf "%s.%s" (split "/" .Values.biomageCi.repo)._1 .Values.myAccount.domainName -}}
{{- else -}}
{{- printf "%s-%s.%s" (split "/" .Values.biomageCi.repo)._1 .Values.biomageCi.sandboxId .Values.myAccount.domainName -}}
{{- end -}}

{{- end -}}
{{- define "serviceAccountRole" -}}
{{- printf "arn:aws:iam::%s:role/%s" .Values.myAccount.accountId .Values.serviceAccount.iamRole -}}
{{- end -}}

{{- define "serviceAccountRoleTemplate"-}}
{{- printf "arn:aws:iam::%s:role/event-exporter-role-stagingIVA" .Values.myAccount.accountId -}}
{{- end -}}


{{/*
Get SecRule's arguments with unescaped single&double quotes
*/}}
{{- define "secrule" -}}
{{- $operator := .operator | quote | replace "\"" "\\\"" | replace "'" "\\'" -}}
{{- $action := .action | quote | replace "\"" "\\\"" | replace "'" "\\'" -}}
{{- printf "SecRule %s %s %s" .variable $operator $action -}}
{{- end -}}