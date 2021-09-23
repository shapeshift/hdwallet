echo "BEGIN"
for ((i=0; i<${#NPM_TOKEN}; i++)); do
	echo "${NPM_TOKEN:$i:1}"
done
echo "DONE"
