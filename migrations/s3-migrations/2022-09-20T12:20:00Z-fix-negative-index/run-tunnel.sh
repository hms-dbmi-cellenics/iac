MIGRATION_ENV=$1
echo ${PASSWORD} | sudo -k -S kill -9 119
nohup biomage rds tunnel -i ${MIGRATION_ENV} &

