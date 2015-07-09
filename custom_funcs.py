def is_reassortant(G, node):
	return G.node[node]['reassortant']

def impute_reassortant_status(G):
	for n, d in G.nodes(data=True):
		in_edge_types = set([d['edge_type'] for sc, sk, d in G.in_edges(n, data=True)])
		if 'reassortant' in in_edge_types:
			G.node[n]['reassortant'] = True
		elif 'full_complement' in in_edge_types:
			G.node[n]['reassortant'] = False
		else:
			G.node[n]['reassortant'] = False

